from rest_framework.routers import DefaultRouter
from django.urls import path
from .views import ClientViewSet, TenantListView, TenantUsersView, TenantDetailView, TenantLogoView

router = DefaultRouter()
router.register(r'clients', ClientViewSet, basename='client')

urlpatterns = router.urls + [
    path('tenants/', TenantListView.as_view(), name='tenant-list'),
    path('tenants/<int:pk>/', TenantDetailView.as_view(), name='tenant-detail'),
    path('tenants/<int:tenant_id>/users/', TenantUsersView.as_view(), name='tenant-users'),
    path('tenants/<int:tenant_id>/logo/', TenantLogoView.as_view(), name='tenant-logo'),
]
