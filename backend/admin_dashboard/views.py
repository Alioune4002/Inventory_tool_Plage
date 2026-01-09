import csv
import hashlib
import logging
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, F, Sum
from django.db.models.functions import TruncDate
from django.http import HttpResponse
from django.utils import timezone

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Service, UserProfile
from kds.models import Order
from pos.models import PosTicket

from .models import AdminDailyMetric, AdminVisitEvent
from .serializers import TrackVisitSerializer, SetTestAccountSerializer
from .throttles import VisitTrackThrottle

LOGGER = logging.getLogger(__name__)
User = get_user_model()


def _increment_metric(key: str) -> None:
    today = timezone.localdate()
    with transaction.atomic():
        obj, created = AdminDailyMetric.objects.select_for_update().get_or_create(
            key=key,
            date=today,
            defaults={"count": 0},
        )
        obj.count = F("count") + 1
        obj.save(update_fields=["count"])


def _service_type_map(tenant_ids):
    service_types = {}
    if not tenant_ids:
        return service_types
    rows = (
        Service.objects.filter(tenant_id__in=tenant_ids)
        .order_by("created_at")
        .values("tenant_id", "service_type")
    )
    for row in rows:
        if row["tenant_id"] not in service_types:
            service_types[row["tenant_id"]] = row["service_type"]
    return service_types


def _get_profile(user):
    try:
        return user.profile
    except UserProfile.DoesNotExist:
        return None


def _apply_user_filters(users, request):
    email_q = (request.query_params.get("email") or "").strip()
    is_active = request.query_params.get("is_active")
    is_test = request.query_params.get("is_test_account")
    deleted = request.query_params.get("deleted")

    if email_q:
        users = users.filter(email__icontains=email_q)
    if is_active in ("true", "false"):
        users = users.filter(is_active=is_active == "true")
    if is_test in ("true", "false"):
        users = users.filter(profile__is_test_account=is_test == "true")
    if deleted in ("true", "false"):
        if deleted == "true":
            users = users.filter(profile__deleted_at__isnull=False)
        else:
            users = users.filter(profile__deleted_at__isnull=True)
    return users


class TrackVisitView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [VisitTrackThrottle]

    def post(self, request):
        serializer = TrackVisitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        page = serializer.validated_data["page"]
        key_map = {"landing": "visit_landing", "pos": "visit_pos", "kds": "visit_kds"}
        key = key_map.get(page)
        if not key:
            LOGGER.debug("Invalid visit track page: %s", page)
            return Response({"detail": "Page invalide."}, status=status.HTTP_400_BAD_REQUEST)

        ip = _extract_ip(request)
        ua = request.META.get("HTTP_USER_AGENT", "")
        ip_hash = _hash_value(ip) if ip else _hash_value("unknown")
        ua_hash = _hash_value(ua) if ua else _hash_value("unknown")

        try:
            if _should_dedup(page, ip_hash, ua_hash):
                return Response({"ok": True})
            AdminVisitEvent.objects.create(page=page, ip_hash=ip_hash, ua_hash=ua_hash)
            _increment_metric(key)
        except Exception:
            LOGGER.exception("Admin visit track failed")
        return Response({"ok": True})


class AdminUsersView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        users = User.objects.select_related("profile__tenant").order_by("-date_joined")
        users = _apply_user_filters(users, request)
        tenant_ids = []
        for u in users:
            profile = _get_profile(u)
            if profile and profile.tenant_id:
                tenant_ids.append(profile.tenant_id)
        service_types = _service_type_map(tenant_ids)

        pos_tenant_ids = set(
            PosTicket.objects.filter(tenant_id__in=tenant_ids)
            .values_list("tenant_id", flat=True)
            .distinct()
        )
        kds_tenant_ids = set(
            Order.objects.filter(tenant_id__in=tenant_ids)
            .values_list("tenant_id", flat=True)
            .distinct()
        )

        payload = []
        for u in users:
            profile = _get_profile(u)
            tenant = getattr(profile, "tenant", None)
            tenant_id = tenant.id if tenant else None
            payload.append(
                {
                    "id": u.id,
                    "email": u.email,
                    "date_joined": u.date_joined,
                    "last_login": u.last_login,
                    "is_active": u.is_active,
                    "is_test_account": getattr(profile, "is_test_account", False),
                    "deleted_at": getattr(profile, "deleted_at", None),
                    "service_type": service_types.get(tenant_id),
                    "tenant": {"id": tenant_id, "name": getattr(tenant, "name", None)} if tenant else None,
                    "modules": {
                        "stockscan": bool(tenant_id),
                        "pos": tenant_id in pos_tenant_ids,
                        "kds": tenant_id in kds_tenant_ids,
                    },
                }
            )

        return Response({"users": payload})


class AdminUserDisableView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, user_id: int):
        if request.user.id == user_id:
            return Response({"detail": "Action interdite sur soi-même."}, status=status.HTTP_400_BAD_REQUEST)
        user = User.objects.filter(id=user_id).first()
        if not user:
            return Response({"detail": "Utilisateur introuvable."}, status=status.HTTP_404_NOT_FOUND)
        user.is_active = False
        user.save(update_fields=["is_active"])
        return Response({"ok": True})


class AdminUserSoftDeleteView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, user_id: int):
        if request.user.id == user_id:
            return Response({"detail": "Action interdite sur soi-même."}, status=status.HTTP_400_BAD_REQUEST)
        user = User.objects.filter(id=user_id).select_related("profile").first()
        if not user:
            return Response({"detail": "Utilisateur introuvable."}, status=status.HTTP_404_NOT_FOUND)
        profile = getattr(user, "profile", None)
        if profile:
            profile.deleted_at = timezone.now()
            profile.save(update_fields=["deleted_at"])
        user.is_active = False
        user.save(update_fields=["is_active"])
        return Response({"ok": True})


class AdminUserSetTestView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, user_id: int):
        serializer = SetTestAccountSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = User.objects.filter(id=user_id).select_related("profile").first()
        if not user or not getattr(user, "profile", None):
            return Response({"detail": "Utilisateur introuvable."}, status=status.HTTP_404_NOT_FOUND)
        user.profile.is_test_account = serializer.validated_data["is_test_account"]
        user.profile.save(update_fields=["is_test_account"])
        return Response({"ok": True})


class AdminStatsView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        since = timezone.localdate() - timedelta(days=30)

        signups = (
            User.objects.filter(date_joined__date__gte=since)
            .values("date_joined__date")
            .annotate(count=Count("id"))
            .order_by("date_joined__date")
        )
        signup_payload = [
            {"date": row["date_joined__date"].isoformat(), "count": row["count"]} for row in signups
        ]

        metrics = (
            AdminDailyMetric.objects.filter(date__gte=since)
            .values("key")
            .annotate(total=Sum("count"))
        )
        metrics_totals = {m["key"]: int(m["total"] or 0) for m in metrics}

        visits_payload = {
            "root": metrics_totals.get("visit_landing", 0) + metrics_totals.get("visit_root", 0),
            "pos": metrics_totals.get("visit_pos", 0),
            "kds": metrics_totals.get("visit_kds", 0),
        }

        pos_tenants = PosTicket.objects.values("tenant_id").distinct().count()
        kds_tenants = Order.objects.values("tenant_id").distinct().count()

        return Response(
            {
                "signups": signup_payload,
                "visits": visits_payload,
                "activations": {"pos": pos_tenants, "kds": kds_tenants},
            }
        )


class AdminUsersExportCsvView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        users = User.objects.select_related("profile").order_by("-date_joined")
        users = _apply_user_filters(users, request)

        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="stockscan-users.csv"'
        response.write("\ufeff")
        writer = csv.writer(response, delimiter=";")
        writer.writerow(
            ["id", "email", "date_joined", "is_active", "is_staff", "is_test_account", "deleted_at"]
        )

        for user in users:
            profile = _get_profile(user)
            writer.writerow(
                [
                    user.id,
                    user.email,
                    user.date_joined.isoformat() if user.date_joined else "",
                    str(bool(user.is_active)).lower(),
                    str(bool(user.is_staff)).lower(),
                    str(bool(getattr(profile, "is_test_account", False))).lower(),
                    getattr(profile, "deleted_at", None).isoformat() if profile and profile.deleted_at else "",
                ]
            )

        return response


class AdminVisitsExportCsvView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        page = (request.query_params.get("page") or "").strip()
        allowed_pages = {"landing", "pos", "kds"}
        if page and page not in allowed_pages:
            return Response({"detail": "Page invalide."}, status=status.HTTP_400_BAD_REQUEST)

        from_str = (request.query_params.get("from") or "").strip()
        to_str = (request.query_params.get("to") or "").strip()
        today = timezone.localdate()
        try:
            from_date = timezone.datetime.fromisoformat(from_str).date() if from_str else today - timedelta(days=30)
        except ValueError:
            return Response({"detail": "Parametre from invalide."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            to_date = timezone.datetime.fromisoformat(to_str).date() if to_str else today
        except ValueError:
            return Response({"detail": "Parametre to invalide."}, status=status.HTTP_400_BAD_REQUEST)

        queryset = AdminVisitEvent.objects.all()
        if page:
            queryset = queryset.filter(page=page)
        queryset = queryset.filter(created_at__date__gte=from_date, created_at__date__lte=to_date)

        rows = (
            queryset.annotate(day=TruncDate("created_at"))
            .values("page", "day")
            .annotate(count=Count("id"))
            .order_by("page", "day")
        )

        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="stockscan-visits.csv"'
        response.write("\ufeff")
        writer = csv.writer(response, delimiter=";")
        writer.writerow(["page", "created_at", "count"])

        total_count = 0
        for row in rows:
            total_count += int(row["count"] or 0)
            writer.writerow([row["page"], row["day"].isoformat(), row["count"]])

        writer.writerow(["TOTAL", "", total_count])
        return response


def _hash_value(value: str) -> str:
    salt = getattr(settings, "SECRET_KEY", "stockscan")
    payload = f"{value}:{salt}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _extract_ip(request) -> str:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "") or ""


def _should_dedup(page: str, ip_hash: str, ua_hash: str, window_minutes: int = 10) -> bool:
    since = timezone.now() - timedelta(minutes=window_minutes)
    return AdminVisitEvent.objects.filter(
        page=page,
        ip_hash=ip_hash,
        ua_hash=ua_hash,
        created_at__gte=since,
    ).exists()
