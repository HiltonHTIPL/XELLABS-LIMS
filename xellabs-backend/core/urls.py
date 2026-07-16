from rest_framework.routers import DefaultRouter
from django.urls import path
from .views import (
    ClientViewSet, UserViewSet, TenantListView, TenantUsersView, TenantDetailView, TenantLogoView,
    TenantManagementViewSet, ClientResetPasswordView, SenaiteInstrumentImportView,
    SenaiteStorageLocationImportView, SenaiteMasterDataDeleteView,
    SenaiteGroupsView, SenaiteGroupDetailView, SenaiteGroupRoleView,
)

router = DefaultRouter()
router.register(r'clients', ClientViewSet, basename='client')
router.register(r'users', UserViewSet, basename='staff-user')
router.register(r'tenant-management', TenantManagementViewSet, basename='tenant-management')

from .dashboard import DashboardView

urlpatterns = router.urls + [
    path('dashboard/', DashboardView.as_view(), name='dashboard'),
    path('tenants/', TenantListView.as_view(), name='tenant-list'),
    path('tenants/<int:pk>/', TenantDetailView.as_view(), name='tenant-detail'),
    path('tenants/<int:tenant_id>/users/', TenantUsersView.as_view(), name='tenant-users'),
    path('tenants/<int:tenant_id>/logo/', TenantLogoView.as_view(), name='tenant-logo'),
    path('clients/<int:client_id>/reset-password/', ClientResetPasswordView.as_view(), name='client-reset-password'),
    path('senaite-import/instruments/', SenaiteInstrumentImportView.as_view(), name='senaite-import-instruments'),
    path('senaite-import/storage-locations/', SenaiteStorageLocationImportView.as_view(), name='senaite-import-storage-locations'),
    path('senaite-import/delete/', SenaiteMasterDataDeleteView.as_view(), name='senaite-import-delete'),
    path('senaite-groups/', SenaiteGroupsView.as_view(), name='senaite-groups'),
    path('senaite-groups/<str:group_id>/', SenaiteGroupDetailView.as_view(), name='senaite-group-detail'),
    path('senaite-groups/<str:group_id>/role/', SenaiteGroupRoleView.as_view(), name='senaite-group-role'),
]
