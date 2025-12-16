from rest_framework import permissions
from .utils import get_user_role


class RolePermission(permissions.BasePermission):
    """
    Allow access based on role for the current tenant.
    allowed_roles: list of roles allowed.
    """
    allowed_roles = []

    def has_permission(self, request, view):
        role = get_user_role(request)
        return role in self.allowed_roles


class ProductPermission(RolePermission):
    allowed_roles = ['owner', 'manager', 'operator']


class ManagerPermission(RolePermission):
    allowed_roles = ['owner', 'manager']
