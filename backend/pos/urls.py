from django.urls import path

from .views import pos_products_search, pos_checkout, pos_reports_summary, pos_tickets


urlpatterns = [
    path("products/search/", pos_products_search, name="pos_products_search"),
    path("tickets/checkout/", pos_checkout, name="pos_checkout"),
    path("reports/summary/", pos_reports_summary, name="pos_reports_summary"),
    path("tickets/", pos_tickets, name="pos_tickets"),
]
