from django.db.models import Sum, F, DecimalField, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .models import StorageLocation, Reagent, Standard, Solvent, Lot, InventoryTransaction, ExpiryAlert
from .serializers import (
    StorageLocationSerializer, ReagentSerializer, StandardSerializer,
    SolventSerializer, LotSerializer, InventoryTransactionSerializer, ExpiryAlertSerializer,
)


class StorageLocationViewSet(viewsets.ModelViewSet):
    queryset = StorageLocation.objects.all()
    serializer_class = StorageLocationSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["location_type", "parent"]
    search_fields = ["name"]


class ReagentViewSet(viewsets.ModelViewSet):
    queryset = Reagent.objects.all()
    serializer_class = ReagentSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["is_active"]
    search_fields = ["name", "catalog_number", "cas_number"]


class StandardViewSet(viewsets.ModelViewSet):
    queryset = Standard.objects.all()
    serializer_class = StandardSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["is_active"]
    search_fields = ["name", "catalog_number"]


class SolventViewSet(viewsets.ModelViewSet):
    queryset = Solvent.objects.all()
    serializer_class = SolventSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["is_active"]
    search_fields = ["name", "catalog_number"]


class LotViewSet(viewsets.ModelViewSet):
    queryset = Lot.objects.select_related("storage_location", "created_by").all()
    serializer_class = LotSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["storage_location", "content_type"]
    ordering_fields = ["received_date", "expiry_date"]

    @action(detail=False, methods=["get"], url_path="low-stock")
    def low_stock(self, request):
        """Return lots whose current quantity is below their item's min_stock_level."""
        from django.contrib.contenttypes.models import ContentType
        from decimal import Decimal

        results = []
        for ct in ContentType.objects.filter(app_label="inventory", model__in=["reagent", "standard", "solvent"]):
            model_cls = ct.model_class()
            if model_cls is None:
                continue
            for item in model_cls.objects.filter(is_active=True):
                lots = Lot.objects.filter(content_type=ct, object_id=item.pk)
                total_in = (
                    InventoryTransaction.objects.filter(lot__in=lots, transaction_type="in")
                    .aggregate(s=Coalesce(Sum("quantity"), Decimal("0")))["s"]
                )
                total_out = (
                    InventoryTransaction.objects.filter(lot__in=lots, transaction_type__in=["out", "dispose"])
                    .aggregate(s=Coalesce(Sum("quantity"), Decimal("0")))["s"]
                )
                current = total_in - total_out
                if current < item.min_stock_level:
                    results.append({
                        "item_type": ct.model,
                        "item_id": item.pk,
                        "name": item.name,
                        "current_quantity": float(current),
                        "min_stock_level": float(item.min_stock_level),
                        "unit": item.unit,
                    })
        return Response(results)


class InventoryTransactionViewSet(viewsets.ModelViewSet):
    queryset = InventoryTransaction.objects.select_related("lot", "created_by").all()
    serializer_class = InventoryTransactionSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["transaction_type", "lot"]
    ordering_fields = ["created_at"]


class ExpiryAlertViewSet(viewsets.ModelViewSet):
    queryset = ExpiryAlert.objects.select_related("lot", "acknowledged_by").all()
    serializer_class = ExpiryAlertSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["is_acknowledged"]

    @action(detail=True, methods=["post"])
    def acknowledge(self, request, pk=None):
        alert = self.get_object()
        if alert.is_acknowledged:
            return Response({"detail": "Already acknowledged."}, status=status.HTTP_400_BAD_REQUEST)
        alert.is_acknowledged = True
        alert.acknowledged_by = request.user
        alert.save(update_fields=["is_acknowledged", "acknowledged_by"])
        return Response(ExpiryAlertSerializer(alert).data)

    @action(detail=False, methods=["get"], url_path="upcoming")
    def upcoming(self, request):
        """Return unacknowledged alerts for lots expiring within 30 days."""
        cutoff = timezone.now().date() + timezone.timedelta(days=30)
        qs = self.get_queryset().filter(is_acknowledged=False, alert_date__lte=cutoff)
        return Response(ExpiryAlertSerializer(qs, many=True).data)
