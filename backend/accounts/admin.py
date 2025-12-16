from django.contrib import admin
from .models import Tenant, UserProfile, Service


@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "domain", "created_at")
    search_fields = ("name", "domain")


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "tenant", "role", "created_at")
    search_fields = ("user__username", "tenant__name", "role")
    list_filter = ("role",)


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "tenant", "created_at")
    search_fields = ("name", "tenant__name")
    list_filter = ("tenant",)
