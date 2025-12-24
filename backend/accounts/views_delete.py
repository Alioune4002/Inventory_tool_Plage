
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions

from .models import Tenant, Membership, UserProfile


class DeleteAccountView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request):
        user = request.user

        # tenant via profile si présent, sinon via membership si possible
        profile = getattr(user, "profile", None)
        tenant = getattr(profile, "tenant", None) if profile else None

        if not tenant:
            m = Membership.objects.filter(user=user).select_related("tenant").first()
            tenant = m.tenant if m else None

        # aucun tenant => delete user
        if not tenant:
            user.delete()
            return Response({"detail": "Compte supprimé."}, status=200)

        members_count = Membership.objects.filter(tenant=tenant).count()

        # Si seul membre => delete tenant cascade + user
        if members_count <= 1:
            tenant_name = tenant.name
            tenant.delete()
            user.delete()
            return Response({"detail": f"Compte et tenant '{tenant_name}' supprimés."}, status=200)

        # Sinon: retirer memberships + profile, puis supprimer user
        Membership.objects.filter(user=user, tenant=tenant).delete()
        if profile and getattr(profile, "tenant_id", None) == tenant.id:
            profile.delete()

        user.delete()
        return Response({"detail": "Compte supprimé (tenant conservé car d'autres membres existent)."}, status=200)