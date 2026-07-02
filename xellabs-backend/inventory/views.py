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
        from collections import defaultdict

        results = []
        for ct in ContentType.objects.filter(app_label="inventory", model__in=["reagent", "standard", "solvent"]):
            model_cls = ct.model_class()
            if model_cls is None:
                continue
            items = list(model_cls.objects.filter(is_active=True))
            if not items:
                continue

            # One query for all lots of this item type, one query for all their
            # transactions — instead of 2 queries per item.
            lot_to_object = dict(
                Lot.objects.filter(content_type=ct, object_id__in=[i.pk for i in items])
                .values_list("pk", "object_id")
            )
            net_by_object = defaultdict(Decimal)
            if lot_to_object:
                txns = (
                    InventoryTransaction.objects
                    .filter(lot_id__in=lot_to_object.keys())
                    .values("lot_id", "transaction_type")
                    .annotate(total=Coalesce(Sum("quantity"), Decimal("0")))
                )
                for row in txns:
                    object_id = lot_to_object[row["lot_id"]]
                    sign = 1 if row["transaction_type"] == "in" else (-1 if row["transaction_type"] in ("out", "dispose") else 0)
                    net_by_object[object_id] += sign * row["total"]

            for item in items:
                current = net_by_object.get(item.pk, Decimal("0"))
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

    def perform_create(self, serializer):
        from django.contrib.contenttypes.models import ContentType
        from audittrail.models import AuditEvent
        txn = serializer.save()
        AuditEvent.objects.create(
            user=self.request.user,
            action="create",
            content_type=ContentType.objects.get_for_model(txn),
            object_id=txn.pk,
            object_repr=str(txn),
            extra_data={"transaction_type": txn.transaction_type, "quantity": float(txn.quantity), "lot_id": txn.lot_id},
        )


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

        from django.contrib.contenttypes.models import ContentType
        from audittrail.models import AuditEvent
        AuditEvent.objects.create(
            user=request.user,
            action="update",
            content_type=ContentType.objects.get_for_model(alert),
            object_id=alert.pk,
            object_repr=str(alert),
            extra_data={"acknowledged": True},
        )
        return Response(ExpiryAlertSerializer(alert).data)

    @action(detail=False, methods=["get"], url_path="upcoming")
    def upcoming(self, request):
        """Return unacknowledged alerts for lots expiring within 30 days."""
        cutoff = timezone.now().date() + timezone.timedelta(days=30)
        qs = self.get_queryset().filter(is_acknowledged=False, alert_date__lte=cutoff)
        return Response(ExpiryAlertSerializer(qs, many=True).data)
