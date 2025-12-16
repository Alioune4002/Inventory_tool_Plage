from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions

from .models import Tenant, UserProfile


class DeleteAccountView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request):
        user = request.user
        profile = getattr(user, "profile", None)
        if not profile:
            user.delete()
            return Response({"detail": "Compte supprimé."}, status=200)

        tenant = profile.tenant
        # Combien d'utilisateurs sont liés à ce tenant ?
        profiles = UserProfile.objects.filter(tenant=tenant)
        if profiles.count() <= 1:
            tenant_name = tenant.name
            tenant.delete()  # cascade sur services / produits
            user.delete()
            return Response({"detail": f"Compte et tenant '{tenant_name}' supprimés."}, status=200)

        # Sinon on supprime juste l'utilisateur de ce tenant
        profile.delete()
        user.delete()
        return Response({"detail": "Compte supprimé (tenant conservé car d'autres membres existent)."}, status=200)
