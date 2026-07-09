from django.db.models import Sum, F, DecimalField, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend
from core.permissions import CAN_RECEIVE_OR_STORE_ROLES
from .models import StorageLocation, Reagent, Standard, Solvent, Lot, InventoryTransaction, ExpiryAlert
from .serializers import (
    StorageLocationSerializer, ReagentSerializer, StandardSerializer,
    SolventSerializer, LotSerializer, InventoryTransactionSerializer, ExpiryAlertSerializer,
)


def _assign_sample_to_slot(slot, sample_id, user):
    """Single owner of "a sample enters a slot": race-guarded occupy + audit log.

    Used by both the direct `assign` action and `assign-by-label` so the
    audit trail and conflict handling are identical regardless of entry path.
    Returns (slot, None) on success or (None, (message, http_status)) on failure.
    """
    if slot.is_occupied:
        return None, (f"Slot {slot.slot_id} is already occupied.", status.HTTP_400_BAD_REQUEST)

    # Release any slot this sample already occupies elsewhere first — otherwise
    # re-receiving/moving a sample into a new slot leaves the old one falsely
    # marked occupied forever (an orphan).
    StorageLocation.objects.filter(
        location_type='box_location', assigned_sample_id=sample_id, is_occupied=True
    ).exclude(pk=slot.pk).update(is_occupied=False, assigned_sample_id='')

    # Atomic update — only succeeds if currently free (prevents race condition)
    updated = StorageLocation.objects.filter(id=slot.pk, is_occupied=False).update(
        is_occupied=True, assigned_sample_id=sample_id
    )
    if updated == 0:
        return None, (f"Slot {slot.slot_id} was just occupied by another request.", status.HTTP_409_CONFLICT)

    slot.refresh_from_db()

    from core.senaite_service import _build_storage_path
    storage_path = _build_storage_path(slot)

    # StorageLocation.assigned_sample_id is the authoritative record, but the
    # Sample list/detail pages display the denormalized Sample.storage_location
    # text field — sync it here, the single place a sample enters a slot, so
    # those pages never go stale regardless of which entry path (direct assign
    # or scanned assign-by-label) was used.
    from lims.models import Sample
    Sample.objects.filter(sample_id=sample_id).update(storage_location=storage_path)

    from django.contrib.contenttypes.models import ContentType
    from audittrail.models import AuditEvent
    AuditEvent.objects.create(
        user=user,
        action="store",
        content_type=ContentType.objects.get_for_model(slot),
        object_id=slot.pk,
        object_repr=f"Sample {sample_id} -> {storage_path}",
        extra_data={
            "sample_id": sample_id,
            "storage_path": storage_path,
            "slot_id": slot.slot_id,
            "storage_location_id": slot.pk,
            # senaite_uid intentionally excluded — internal field
        },
    )
    return slot, None


def _location_path_parts(location):
    """Ancestor names root-first, e.g. ['Roy Collection Point', ..., 'Box 1', 'A1'].
    Slots use their slot_id as the leaf (their name repeats the box name)."""
    parts = []
    node = location
    while node:
        parts.insert(0, node.slot_id if node.location_type == 'box_location' and node.slot_id else node.name)
        node = node.parent
    return parts


class _StorageLocationPagination(PageNumberPagination):
    page_size = 50


class StorageLocationViewSet(viewsets.ModelViewSet):
    queryset = StorageLocation.objects.all()
    serializer_class = StorageLocationSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["location_type", "parent", "is_occupied", "assigned_sample_id"]
    search_fields = ["name", "slot_id", "label_code"]
    # Explicitly enable pagination to prevent returning 10K+ locations at once
    # Client can request subsequent pages; tree-building should paginate server-side
    pagination_class = _StorageLocationPagination

    @action(detail=False, methods=["get"], url_path="chain-of-custody")
    def chain_of_custody(self, request):
        """Look up storage + audit history for a sample by sample_id."""
        sample_id = (request.query_params.get("sample_id") or "").strip()
        if not sample_id:
            return Response({"error": "sample_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        # Fetch sample from lims — search by sample_id OR barcode
        from lims.models import Sample
        sample_obj = (
            Sample.objects.select_related("sample_type", "client", "received_by")
            .filter(sample_id=sample_id)
            .first()
        )
        if not sample_obj:
            # Try barcode lookup
            sample_obj = (
                Sample.objects.select_related("sample_type", "client", "received_by")
                .filter(barcode=sample_id)
                .first()
            )
        if not sample_obj:
            return Response({"error": f"Sample '{sample_id}' not found."}, status=status.HTTP_404_NOT_FOUND)

        # Use the canonical sample_id (barcode scan may have passed barcode value)
        canonical_id = sample_obj.sample_id

        sample_data = {
            "sample_id": canonical_id,
            "status": sample_obj.status,
            "status_display": sample_obj.get_status_display(),
            "sample_type": sample_obj.sample_type.name if sample_obj.sample_type else "",
            "client": sample_obj.client.name if sample_obj.client else "",
            "barcode": sample_obj.barcode or "",
            "collection_date": sample_obj.collection_date.isoformat() if sample_obj.collection_date else None,
            "received_date": sample_obj.received_date.isoformat() if sample_obj.received_date else None,
            "expiry_date": sample_obj.expiry_date.isoformat() if sample_obj.expiry_date else None,
            "condition": sample_obj.condition or "",
            "seal_condition": sample_obj.seal_condition or "",
            "priority": sample_obj.priority or "",
            "storage_requirement": sample_obj.storage_requirement or "",
            "sampling_deviation": sample_obj.sampling_deviation or "",
            "quantity_received": str(sample_obj.quantity_received) if sample_obj.quantity_received is not None else "",
            "quantity_unit": sample_obj.quantity_unit or "",
            "hold_for_qa": sample_obj.hold_for_qa,
            "received_by": (
                sample_obj.received_by.get_full_name() or sample_obj.received_by.username
            ) if sample_obj.received_by else "",
            "receipt_notes": sample_obj.receipt_notes or "",
            "collector": sample_obj.collector or "",
            "client_order_number": sample_obj.client_order_number or "",
            "composite": sample_obj.composite,
            "container_type": sample_obj.container_type or "",
            "preservation": sample_obj.preservation or "",
            "sample_point": sample_obj.sample_point or "",
        }

        # Current slot holding this sample
        slot = StorageLocation.objects.filter(
            location_type="box_location", assigned_sample_id=canonical_id
        ).select_related("parent__parent__parent__parent").first()

        current_location = None
        if slot:
            path_parts = []
            node = slot
            while node:
                path_parts.insert(0, node.name)
                node = node.parent
            # Capacity of the parent box
            capacity = None
            if slot.parent and slot.parent.location_type == "box":
                box = slot.parent
                total = StorageLocation.objects.filter(parent=box, location_type="box_location").count()
                occupied = StorageLocation.objects.filter(parent=box, location_type="box_location", is_occupied=True).count()
                capacity = {"total": total, "occupied": occupied, "free": total - occupied}
            current_location = {
                "slot_id": slot.slot_id,
                "slot_name": slot.name,
                "storage_path": " / ".join(path_parts),
                "temperature": slot.parent.temperature if slot.parent else "",
                "capacity": capacity,
            }

        # Build full audit history from multiple sources
        from audittrail.models import AuditEvent
        history = []

        # 1. Sample registration event
        history.append({
            "id": 0,
            "timestamp": sample_obj.created_at.isoformat(),
            "user": (
                sample_obj.created_by.get_full_name() or sample_obj.created_by.username
            ) if hasattr(sample_obj, "created_by") and sample_obj.created_by else "System",
            "event_type": "sample_registered",
            "label": "Sample Registered",
            "details": {"sample_id": canonical_id, "sample_type": sample_data["sample_type"]},
        })

        # 2. Sample received event (if received_date is set)
        if sample_obj.received_date:
            history.append({
                "id": -1,
                "timestamp": sample_obj.received_date.isoformat(),
                "user": sample_data["received_by"] or "System",
                "event_type": "sample_received",
                "label": "Sample Received",
                "details": {
                    "condition": sample_data["condition"],
                    "seal_condition": sample_data["seal_condition"],
                    "quantity": sample_data["quantity_received"],
                    "unit": sample_data["quantity_unit"],
                },
            })

        # 3. Store/release events from AuditEvent
        audit_events = AuditEvent.objects.filter(
            object_repr__icontains=canonical_id
        ).select_related("user").order_by("timestamp")

        for e in audit_events:
            extra = e.extra_data or {}
            if e.action == "store":
                history.append({
                    "id": e.pk,
                    "timestamp": e.timestamp.isoformat(),
                    "user": e.user.get_full_name() or e.user.username if e.user else "System",
                    "event_type": "stored",
                    "label": "Stored in " + extra.get("storage_path", "Storage"),
                    "details": extra,
                })
            elif e.action == "update" and extra.get("slot_id"):
                history.append({
                    "id": e.pk,
                    "timestamp": e.timestamp.isoformat(),
                    "user": e.user.get_full_name() or e.user.username if e.user else "System",
                    "event_type": "released",
                    "label": "Released from Storage",
                    "details": extra,
                })

        # 4. Status change events from AuditEvent
        status_events = AuditEvent.objects.filter(
            action="update",
            content_type__app_label="lims",
            content_type__model="sample",
            object_repr__icontains=canonical_id,
        ).select_related("user").order_by("timestamp")

        for e in status_events:
            extra = e.extra_data or {}
            if "status" in extra:
                history.append({
                    "id": e.pk,
                    "timestamp": e.timestamp.isoformat(),
                    "user": e.user.get_full_name() or e.user.username if e.user else "System",
                    "event_type": "status_change",
                    "label": f"Status → {extra['status']}",
                    "details": extra,
                })

        # Sort all events by timestamp
        history.sort(key=lambda x: x["timestamp"])

        return Response({
            "sample_id": canonical_id,
            "sample": sample_data,
            "current_location": current_location,
            "history": history,
        })

    @action(detail=True, methods=["post"], url_path="assign")
    def assign(self, request, pk=None):
        """Assign a sample to a box_location slot."""
        slot = self.get_object()

        if not hasattr(request.user, 'role') or request.user.role not in CAN_RECEIVE_OR_STORE_ROLES:
            return Response({"error": "You do not have permission to assign samples to storage."}, status=status.HTTP_403_FORBIDDEN)

        if slot.location_type != 'box_location':
            return Response({"error": "Only box_location slots can be assigned."}, status=status.HTTP_400_BAD_REQUEST)

        sample_id = (request.data.get("sample_id") or "").strip()
        if not sample_id:
            return Response({"error": "sample_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        slot, err = _assign_sample_to_slot(slot, sample_id, request.user)
        if err:
            message, http_status = err
            return Response({"error": message}, status=http_status)

        return Response(self.get_serializer(slot).data)

    @action(detail=False, methods=["get"], url_path="resolve-label")
    def resolve_label(self, request):
        """Resolve a scanned/typed label code (box 'BX-0001' or slot 'BX-0001-A1')
        to its location, readable path, and availability. Single indexed lookup."""
        code = (request.query_params.get("code") or "").strip().upper()
        if not code:
            return Response({"error": "code is required."}, status=status.HTTP_400_BAD_REQUEST)

        loc = StorageLocation.objects.filter(label_code=code).select_related(
            "parent__parent__parent__parent"
        ).first()
        if not loc:
            return Response({"error": f"No storage location found for code '{code}'."},
                            status=status.HTTP_404_NOT_FOUND)

        data = {
            "id": loc.pk,
            "label_code": loc.label_code,
            "location_type": loc.location_type,
            "path": _location_path_parts(loc),
        }
        if loc.location_type == "box_location":
            data["is_occupied"] = loc.is_occupied
            if loc.is_occupied:
                data["error"] = f"Slot {loc.slot_id} is already occupied."
        elif loc.location_type == "box":
            slots = StorageLocation.objects.filter(parent=loc, location_type="box_location")
            total = slots.count()
            free = slots.filter(is_occupied=False).count()
            data["capacity"] = {"total": total, "free": free}
            if free == 0:
                data["error"] = f"Box {loc.name} is full."
            else:
                # pk order == creation order == A1..A10, B1.. — correct natural order
                first_free = slots.filter(is_occupied=False).order_by("pk").first()
                data["next_free_slot"] = {"id": first_free.pk, "slot_id": first_free.slot_id,
                                          "label_code": first_free.label_code}
        else:
            data["error"] = "Only box or slot labels can be used for sample storage."
        return Response(data)

    @action(detail=False, methods=["post"], url_path="assign-by-label")
    def assign_by_label(self, request):
        """Assign a sample by scanned label code. Slot code → that exact slot;
        box code → first free slot in the box (400 'Box is full' if none)."""
        if not hasattr(request.user, 'role') or request.user.role not in CAN_RECEIVE_OR_STORE_ROLES:
            return Response({"error": "You do not have permission to assign samples to storage."},
                            status=status.HTTP_403_FORBIDDEN)

        code = (request.data.get("label_code") or "").strip().upper()
        sample_id = (request.data.get("sample_id") or "").strip()
        if not code or not sample_id:
            return Response({"error": "label_code and sample_id are required."},
                            status=status.HTTP_400_BAD_REQUEST)

        loc = StorageLocation.objects.filter(label_code=code).first()
        if not loc:
            return Response({"error": f"No storage location found for code '{code}'."},
                            status=status.HTTP_404_NOT_FOUND)

        if loc.location_type == "box_location":
            slot, err = _assign_sample_to_slot(loc, sample_id, request.user)
            if err:
                return Response({"error": err[0]}, status=err[1])
            return Response(self.get_serializer(slot).data)

        if loc.location_type == "box":
            # Retry over free slots in natural order — if a concurrent scan takes
            # the first one, fall through to the next instead of failing.
            free_slots = list(
                StorageLocation.objects.filter(parent=loc, location_type="box_location", is_occupied=False)
                .order_by("pk")[:5]
            )
            if not free_slots:
                return Response({"error": f"Box {loc.name} is full."}, status=status.HTTP_400_BAD_REQUEST)
            last_err = None
            for candidate in free_slots:
                slot, err = _assign_sample_to_slot(candidate, sample_id, request.user)
                if not err:
                    return Response(self.get_serializer(slot).data)
                last_err = err
            return Response({"error": last_err[0]}, status=last_err[1])

        return Response({"error": "Only box or slot labels can be used for sample storage."},
                        status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"], url_path="unassign")
    def unassign(self, request, pk=None):
        """Release a box_location slot — marks it as free."""
        slot = self.get_object()

        if not hasattr(request.user, 'role') or request.user.role not in CAN_RECEIVE_OR_STORE_ROLES:
            return Response({"error": "You do not have permission to unassign slots."}, status=status.HTTP_403_FORBIDDEN)

        if slot.location_type != 'box_location':
            return Response({"error": "Only box_location slots can be unassigned."}, status=status.HTTP_400_BAD_REQUEST)

        if not slot.is_occupied:
            return Response({"error": "Slot is already free."}, status=status.HTTP_400_BAD_REQUEST)

        released_sample_id = slot.assigned_sample_id

        updated = StorageLocation.objects.filter(id=slot.pk, is_occupied=True).update(
            is_occupied=False, assigned_sample_id=''
        )
        if updated == 0:
            return Response({"error": "Slot was already freed by another request."}, status=status.HTTP_409_CONFLICT)

        slot.refresh_from_db()

        # Mirror the sync in _assign_sample_to_slot — clear the denormalized
        # Sample.storage_location so list/detail pages don't keep showing a
        # slot the sample no longer occupies.
        if released_sample_id:
            from lims.models import Sample
            Sample.objects.filter(sample_id=released_sample_id).update(storage_location='')

        from django.contrib.contenttypes.models import ContentType
        from audittrail.models import AuditEvent
        AuditEvent.objects.create(
            user=request.user,
            action="update",
            content_type=ContentType.objects.get_for_model(slot),
            object_id=slot.pk,
            object_repr=f"Slot {slot.slot_id} unassigned — {slot.name}",
            extra_data={"slot_id": slot.slot_id, "storage_location_id": slot.pk},
        )

        return Response(self.get_serializer(slot).data)

    @action(detail=True, methods=["post"], url_path="regenerate-slots")
    def regenerate_slots(self, request, pk=None):
        """Create any missing box_location slots for a box (idempotent)."""
        box = self.get_object()
        if box.location_type != 'box':
            return Response({"error": "Only boxes can have slots regenerated."}, status=status.HTTP_400_BAD_REQUEST)

        rows = box.rows or 0
        cols = box.columns or 0
        if rows < 1 or cols < 1:
            return Response({"error": "Box has no rows/columns defined."}, status=status.HTTP_400_BAD_REQUEST)

        existing_ids = set(
            StorageLocation.objects.filter(parent=box, location_type='box_location')
            .values_list('slot_id', flat=True)
        )
        inherited = StorageLocation.slot_inherited_fields(box)
        to_create = []
        for r in range(rows):
            row_letter = chr(65 + r)
            for c in range(1, cols + 1):
                slot_id = f"{row_letter}{c}"
                if slot_id not in existing_ids:
                    to_create.append(StorageLocation(
                        name=f"{box.name} — {slot_id}",
                        location_type='box_location',
                        parent=box,
                        slot_id=slot_id,
                        is_occupied=False,
                        label_code=StorageLocation.slot_label_code(box, slot_id),
                        **inherited,
                    ))
        if to_create:
            StorageLocation.objects.bulk_create(to_create)
            # bulk_create() does not fire post_save, so the auto-sync signal
            # in inventory/signals.py never runs for these slots — queue it
            # explicitly here, same schema-aware pattern.
            from django.db import connection
            from .tasks import sync_box_slots_to_senaite
            sync_box_slots_to_senaite.apply_async(args=[box.pk, connection.schema_name], countdown=2)

        return Response({"created": len(to_create), "total": rows * cols})

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()

        # Prevent deleting a location that has occupied slots
        occupied_count = StorageLocation.objects.filter(
            parent=instance, location_type='box_location', is_occupied=True
        ).count()
        if occupied_count > 0:
            return Response(
                {"error": f"Cannot delete: {occupied_count} occupied slot(s) exist. Unassign all samples first."},
                status=status.HTTP_409_CONFLICT,
            )

        # Cascade-delete box_location children before deleting the box
        if instance.location_type == 'box':
            StorageLocation.objects.filter(parent=instance, location_type='box_location').delete()

        return super().destroy(request, *args, **kwargs)


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
