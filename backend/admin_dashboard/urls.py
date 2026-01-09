from django.urls import path

from .views import (
    TrackVisitView,
    AdminUsersView,
    AdminUserDisableView,
    AdminUserSoftDeleteView,
    AdminUserSetTestView,
    AdminStatsView,
    AdminUsersExportCsvView,
    AdminVisitsExportCsvView,
)

urlpatterns = [
    path("track-visit/", TrackVisitView.as_view(), name="admin-track-visit"),
    path("users/", AdminUsersView.as_view(), name="admin-users"),
    path("users/<int:user_id>/disable/", AdminUserDisableView.as_view(), name="admin-user-disable"),
    path("users/<int:user_id>/soft-delete/", AdminUserSoftDeleteView.as_view(), name="admin-user-soft-delete"),
    path("users/<int:user_id>/set-test/", AdminUserSetTestView.as_view(), name="admin-user-set-test"),
    path("stats/", AdminStatsView.as_view(), name="admin-stats"),
    path("users/export.csv", AdminUsersExportCsvView.as_view(), name="admin-users-export"),
    path("visits/export.csv", AdminVisitsExportCsvView.as_view(), name="admin-visits-export"),
]
