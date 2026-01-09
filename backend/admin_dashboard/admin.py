from django.contrib import admin

from .models import AdminDailyMetric, AdminVisitEvent


@admin.register(AdminDailyMetric)
class AdminDailyMetricAdmin(admin.ModelAdmin):
    list_display = ("key", "date", "count")
    list_filter = ("key", "date")
    search_fields = ("key",)


@admin.register(AdminVisitEvent)
class AdminVisitEventAdmin(admin.ModelAdmin):
    list_display = ("page", "created_at")
    list_filter = ("page",)
