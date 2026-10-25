from django.urls import path
from .arms_api import arms_product_list_api

from .api import (
    blog_post_list_api,
    blog_post_detail_api,
    civil_item_detail_api,
    civil_item_list_api,
    contact_request_api,
    item_detail_api,
    item_list_api,
)

app_name = 'main'

urlpatterns = [
    path('api/arms/products/', arms_product_list_api, name='arms-product-list'),
    path('api/contact/', contact_request_api, name='contact-request'),
    path('api/blog/posts/', blog_post_list_api, name='blog-post-list'),
    path('api/blog/posts/<slug:slug>/', blog_post_detail_api, name='blog-post-detail'),
    path('api/items/', item_list_api, name='item-list'),
    path('api/items/<slug:slug>/', item_detail_api, name='item-detail'),
    path('api/civil-items/', civil_item_list_api, name='civil-item-list'),
    path('api/civil-items/<slug:slug>/', civil_item_detail_api, name='civil-item-detail'),
]
