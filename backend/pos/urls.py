from django.urls import path

from .views import (
    pos_products_search,
    pos_checkout,
    pos_reports_summary,
    pos_tickets,
    pos_ticket_detail,
    pos_ticket_cancel,
    pos_session_active,
    pos_session_close,
)


urlpatterns = [
    path("products/search/", pos_products_search, name="pos_products_search"),
    path("tickets/checkout/", pos_checkout, name="pos_checkout"),
    path("reports/summary/", pos_reports_summary, name="pos_reports_summary"),
    path("tickets/", pos_tickets, name="pos_tickets"),
    path("tickets/<int:ticket_id>/", pos_ticket_detail, name="pos_ticket_detail"),
    path("tickets/<int:ticket_id>/cancel/", pos_ticket_cancel, name="pos_ticket_cancel"),
    path("session/active/", pos_session_active, name="pos_session_active"),
    path("session/close/", pos_session_close, name="pos_session_close"),
]
