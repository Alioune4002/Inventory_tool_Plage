from django.urls import path

from . import views

urlpatterns = [
    path("menu-items/", views.kds_menu_items, name="kds_menu_items"),
    path("menu-items/<int:menu_item_id>/", views.kds_menu_item_detail, name="kds_menu_item_detail"),
    path(
        "menu-items/<int:menu_item_id>/availability/",
        views.kds_menu_item_availability,
        name="kds_menu_item_availability",
    ),
    path(
        "menu-items/<int:menu_item_id>/recipe/",
        views.kds_menu_item_recipe,
        name="kds_menu_item_recipe",
    ),
    path("tables/", views.kds_tables, name="kds_tables"),
    path("tables/<int:table_id>/", views.kds_table_detail, name="kds_table_detail"),
    path("orders/", views.kds_orders, name="kds_orders"),
    path("orders/open/", views.kds_orders_open, name="kds_orders_open"),
    path("orders/<int:order_id>/", views.kds_order_detail, name="kds_order_detail"),
    path("orders/<int:order_id>/send/", views.kds_order_send, name="kds_order_send"),
    path("orders/<int:order_id>/ready/", views.kds_order_ready, name="kds_order_ready"),
    path("orders/<int:order_id>/served/", views.kds_order_served, name="kds_order_served"),
    path("orders/<int:order_id>/cancel/", views.kds_order_cancel, name="kds_order_cancel"),
    path("kitchen/feed/", views.kds_kitchen_feed, name="kds_kitchen_feed"),
    path("pos/open-tables/", views.kds_pos_open_tables, name="kds_pos_open_tables"),
    path("pos/orders/<int:order_id>/for-checkout/", views.kds_pos_order_for_checkout, name="kds_pos_order_for_checkout"),
    path("pos/orders/<int:order_id>/mark-paid/", views.kds_pos_order_mark_paid, name="kds_pos_order_mark_paid"),
]
