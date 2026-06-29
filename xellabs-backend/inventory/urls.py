from rest_framework.routers import DefaultRouter
from .views import (
    StorageLocationViewSet, ReagentViewSet, StandardViewSet,
    SolventViewSet, LotViewSet, InventoryTransactionViewSet, ExpiryAlertViewSet,
)

router = DefaultRouter()
router.register("storage-locations", StorageLocationViewSet)
router.register("reagents", ReagentViewSet)
router.register("standards", StandardViewSet)
router.register("solvents", SolventViewSet)
router.register("lots", LotViewSet)
router.register("transactions", InventoryTransactionViewSet)
router.register("expiry-alerts", ExpiryAlertViewSet)

urlpatterns = router.urls
