from django.db.models import Sum, F, DecimalField, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend
from core.permissions import CAN_RECEIVE_OR_STORE_ROLES, ReadOnlyOrAnalystOrAbove, ReadOnlyOrSampleHandler
from .models import StorageLocation, Reagent, Standard, Solvent, Lot, InventoryTransaction, ExpiryAlert
from .serializers import (
    StorageLocationSerializer, ReagentSerializer, StandardSerializer,
    SolventSerializer, LotSerializer, InventoryTransactionSerializer, ExpiryAlertSerializer,
)


def _queue_sample_storage_transition(sample_id: str, transition: str, slot=None):
    """Fire the SENAITE 'store'/'recover' transition for a sample's AnalysisRequest,
    so a XelLabs slot assign/unassign is reflected as a real SENAITE workflow state
    change (see core/senaite_service.py set_sample_storage_transition). Fire-and-forget
    like every other SENAITE sync in this codebase — a sample not yet synced to
    SENAITE (no senaite_uid) simply has nothing to transition, which is fine.

    When `slot` is passed (the box_location being assigned/released) and both
    the slot's parent box and the sample's AR have already synced to SENAITE
    (both have a senaite_uid), also queue writing the AR's uid into the exact
    row/column entry of the box's own PositionsLayout — see
    core/senaite_service.py set_storage_position — so SENAITE's own storage
    box view shows which slot holds which sample, not just the AR's workflow
    state. Skipped silently if the box or slot hasn't synced yet (fire-and-forget,
    same as the transition above)."""
    from lims.models import AnalysisRequest
    from inventory.tasks import sync_sample_storage_transition, sync_sample_storage_position

    ar = (
        AnalysisRequest.objects.filter(sample__sample_id=sample_id)
        .exclude(senaite_uid="")
        .order_by("-pk")
        .first()
    )
    if not ar:
        return
    sync_sample_storage_transition.apply_async(args=[ar.senaite_uid, transition])

    if slot is not None and slot.slot_id and slot.parent_id and slot.parent.senaite_uid:
        sync_sample_storage_position.apply_async(
            args=[slot.parent.senaite_uid, slot.slot_id, ar.senaite_uid, transition == "store"]
        )


def _resolve_canonical_sample_id(sample_id: str) -> str:
    """Normalize whatever identifier a caller passes (Django sample_id, the
    real SENAITE-assigned id, or a barcode — the UI displays the SENAITE id
    as "the" Sample ID, see app/lib/sampleDisplay.ts, so scanned/typed input
    is routinely the SENAITE one) to the canonical Django Sample.sample_id,
    using the same 3-way lookup chain_of_custody already uses. Confirmed live
    that storing anything other than the canonical id in
    StorageLocation.assigned_sample_id silently breaks: the Sample.storage_location
    sync below never matches, and every later "is this sample stored"
    lookup (chain_of_custody's current_location, etc.) filters by the
    canonical id too, so a mismatched key reads as "Not Stored" forever
    despite a slot genuinely being occupied. Falls back to the raw value
    unchanged if no Sample row matches anything (defensive; should not
    normally happen since a real sample must exist to be assigned)."""
    from lims.models import Sample
    match = (
        Sample.objects.filter(sample_id=sample_id).first()
        or Sample.objects.filter(senaite_ar_id=sample_id).first()
        or Sample.objects.filter(barcode=sample_id).first()
    )
    return match.sample_id if match else sample_id


def _assign_sample_to_slot(slot, sample_id, user):
    """Single owner of "a sample enters a slot": race-guarded occupy + audit log.

    Used by both the direct `assign` action and `assign-by-label` so the
    audit trail and conflict handling are identical regardless of entry path.
    Returns (slot, None) on success or (None, (message, http_status)) on failure.
    """
    sample_id = _resolve_canonical_sample_id(sample_id)
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
    # instance.save() (not Queryset.update) so the audittrail post_save signals
    # record this storage change on the Sample itself (CLAUDE.md §5).
    from lims.models import Sample, ChainOfCustody
    client_id = None
    for _sample in Sample.objects.filter(sample_id=sample_id):
        _sample.storage_location = storage_path
        _sample.save(update_fields=["storage_location", "updated_at"])
        client_id = _sample.client_id
        # Real custody handoff into this slot — same lims.ChainOfCustody ledger
        # the manual "Log Custody Event" UI and receive_sample()/dispose_sample()
        # already write to. Previously this path only wrote the generic
        # AuditEvent below, so a sample stored via QR/label assign never showed
        # a "Stored" row in its own Chain of Custody drawer, unlike a sample
        # whose storage was logged manually.
        ChainOfCustody.objects.create(
            sample=_sample, action="stored", to_location=storage_path,
            transferred_by=user, purpose=f"Stored in {slot.slot_id}",
        )

    _queue_sample_storage_transition(sample_id, "store", slot)

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
            "client_id": client_id,
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
    permission_classes = [ReadOnlyOrSampleHandler]
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
        from lims.models import Sample, AnalysisRequestAnalysis
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
            # Try the real SENAITE-assigned id — the UI displays this as "the"
            # Sample ID (see app/lib/sampleDisplay.ts), so a user typing or
            # scanning exactly what's on screen must resolve here too.
            sample_obj = (
                Sample.objects.select_related("sample_type", "client", "received_by")
                .filter(senaite_ar_id=sample_id)
                .first()
            )
        if not sample_obj:
            return Response({"error": f"Sample '{sample_id}' not found."}, status=status.HTTP_404_NOT_FOUND)

        # Use the canonical sample_id (barcode scan may have passed barcode value)
        canonical_id = sample_obj.sample_id

        sample_data = {
            "sample_id": canonical_id,
            "senaite_ar_id": sample_obj.senaite_ar_id or "",
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
            "batch_id": sample_obj.batch_id or "",
            "batch_sub_group": sample_obj.batch_sub_group or "",
            # Required for the formal Chain of Custody document (RFP-style COC
            # requirement: the document that travels with the sample must list
            # the analyses requested on it) — flattened across every
            # AnalysisRequest this sample has, de-duplicated by name.
            "required_analyses": list(dict.fromkeys(
                AnalysisRequestAnalysis.objects.filter(analysis_request__sample=sample_obj)
                .exclude(senaite_service_name="")
                .values_list("senaite_service_name", flat=True)
            )),
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
            elif e.action == "submit" and extra.get("analysisUid"):
                # Per-analysis result submit, bridged from a Worksheet action
                # (app/actions/senaite-worksheets.ts's submitWorksheetResult/
                # submitWorksheetInterimResult) — for a SENAITE-native sample no
                # Django Result row is ever created, so section 5 above (which
                # reads the Django Result table) never sees these at all. This
                # was the reason a sample's Chain of Custody only ever showed
                # the coarse Sample.status milestones and never its own
                # per-analysis "Result Submitted" events.
                history.append({
                    "id": e.pk,
                    "timestamp": e.timestamp.isoformat(),
                    "user": e.user.get_full_name() or e.user.username if e.user else "System",
                    "event_type": "result_submitted",
                    "label": f"Result Submitted — {extra.get('title', '')}".rstrip(" —"),
                    "details": {"test": extra.get("title", ""), "value": extra.get("result", ""), "unit": ""},
                })
            elif e.action == "verify" and extra.get("analysisUid"):
                # Per-analysis verify, same bridge as submit above.
                history.append({
                    "id": e.pk,
                    "timestamp": e.timestamp.isoformat(),
                    "user": e.user.get_full_name() or e.user.username if e.user else "System",
                    "event_type": "result_verified",
                    "label": f"Result Verified — {extra.get('title', '')}".rstrip(" —"),
                    "details": {"test": extra.get("title", ""), "value": "", "unit": ""},
                })

        # 3b. Chain-of-custody ledger (lims.ChainOfCustody) — a dedicated
        # custody-transfer model (from/to location, temperature, condition,
        # regulatory-basis/notes) that this endpoint never read at all, even
        # though receive_sample()/dispose_sample() (lims/services.py) already
        # write to it on every receive and every disposal.
        #
        # Only the ONE "received" row that lands within a minute of
        # Sample.received_date is skipped — that's the auto-generated intake
        # event receive_sample() writes, which section 2 above already
        # synthesizes straight from Sample fields (showing both would
        # duplicate the same moment). Any OTHER "received" row (e.g. an
        # accessioner receiving the sample from a courier mid-chain, logged
        # manually via "Log Custody Event") is a genuinely distinct handoff
        # and must still show — a blanket `.exclude(action="received")` used
        # to drop every one of these, which is the bug this comment replaces.
        from lims.models import ChainOfCustody
        from datetime import timedelta
        custody_records = (
            ChainOfCustody.objects.filter(sample=sample_obj)
            .select_related("transferred_by", "received_by")
            .order_by("timestamp")
        )
        intake_window = None
        if sample_obj.received_date:
            intake_window = (sample_obj.received_date - timedelta(minutes=1), sample_obj.received_date + timedelta(minutes=1))
        for c in custody_records:
            if c.action == "received" and intake_window and intake_window[0] <= c.timestamp <= intake_window[1]:
                continue
            actor = (c.transferred_by.get_full_name() or c.transferred_by.username) if c.transferred_by else "System"
            history.append({
                "id": f"custody-{c.pk}",
                "timestamp": c.timestamp.isoformat(),
                "user": actor,
                "event_type": f"custody_{c.action}",
                "label": c.get_action_display(),
                "details": {
                    "from_location": c.from_location,
                    "to_location": c.to_location,
                    "temperature_c": str(c.temperature_c) if c.temperature_c is not None else None,
                    "condition": c.condition,
                    "purpose": c.purpose,
                    "seal_status": c.get_seal_status_display() if c.seal_status else None,
                    "notes": c.notes,
                    "received_by": (c.received_by.get_full_name() or c.received_by.username) if c.received_by else None,
                },
            })
        # Every action the ChainOfCustody ledger records natively (disposed,
        # and — if ever written — transferred/stored/retrieved/analysed) now
        # has its own detailed event above, so the generic status_change line
        # below would only ever be redundant for those transitions.
        custody_covered_statuses = {"disposed"}

        # 4. Status change events — read from DataChangeLog rather than
        # AuditEvent.extra_data: the generic audit signal (audittrail/signals.py)
        # never actually populates extra_data with a "status" key, so the old
        # `"status" in extra` check here never matched anything — this branch
        # was dead code. DataChangeLog already captures every field-level change
        # (including status) generically for any TRACKED_MODELS instance, scoped
        # precisely by object_id rather than a fuzzy object_repr string match.
        from audittrail.models import DataChangeLog
        status_changes = DataChangeLog.objects.filter(
            audit_event__content_type__app_label="lims",
            audit_event__content_type__model="sample",
            audit_event__object_id=sample_obj.pk,
            field_name="status",
        ).select_related("audit_event", "audit_event__user").order_by("audit_event__timestamp")

        for c in status_changes:
            if c.new_value in custody_covered_statuses:
                continue
            e = c.audit_event
            history.append({
                "id": e.pk,
                "timestamp": e.timestamp.isoformat(),
                "user": e.user.get_full_name() or e.user.username if e.user else "System",
                "event_type": "status_change",
                "label": f"Status: {c.old_value} → {c.new_value}",
                "details": {"old_status": c.old_value, "new_status": c.new_value},
            })

        # 5. Result lifecycle events (submitted / verified / rejected), one per
        # test — these are real chain-of-custody events (who touched this
        # sample's results and when) that were previously invisible here.
        from lims.models import Result
        results = Result.objects.filter(
            worksheet_assignment__analysis_request__sample=sample_obj
        ).select_related("worksheet_assignment", "submitted_by", "verified_by")

        for r in results:
            # WorksheetAssignment.test (a FK to the old Django Test catalog model)
            # was removed in the 2026-07-15 refactor that keyed everything on live
            # SENAITE analysis services instead — this file wasn't updated at the
            # time, so every Chain of Custody lookup for a sample with ANY result
            # history 500'd with a FieldError on "test" (confirmed live, root cause
            # for SO-0001 report). senaite_service_name is the plain-field replacement.
            test_name = r.worksheet_assignment.senaite_service_name
            if r.submitted_at:
                history.append({
                    "id": f"result-{r.pk}-submitted",
                    "timestamp": r.submitted_at.isoformat(),
                    "user": (r.submitted_by.get_full_name() or r.submitted_by.username) if r.submitted_by else "System",
                    "event_type": "result_submitted",
                    "label": f"Result Submitted — {test_name}",
                    "details": {"test": test_name, "value": r.value, "unit": r.unit},
                })
            if r.verified_at:
                history.append({
                    "id": f"result-{r.pk}-verified",
                    "timestamp": r.verified_at.isoformat(),
                    "user": (r.verified_by.get_full_name() or r.verified_by.username) if r.verified_by else "System",
                    "event_type": "result_verified",
                    "label": f"Result Verified — {test_name}",
                    "details": {"test": test_name, "value": r.value, "unit": r.unit},
                })
            elif r.status == "rejected":
                # No dedicated rejected_at/rejected_by field — reject_result()
                # only stamps status+remarks (lims/services.py), so this uses
                # the DataChangeLog entry for this Result's own status change
                # to recover who/when, falling back to unknown if untracked.
                rejected_change = DataChangeLog.objects.filter(
                    audit_event__content_type__app_label="lims",
                    audit_event__content_type__model="result",
                    audit_event__object_id=r.pk,
                    field_name="status",
                    new_value="rejected",
                ).select_related("audit_event", "audit_event__user").order_by("-audit_event__timestamp").first()
                if rejected_change:
                    e = rejected_change.audit_event
                    history.append({
                        "id": f"result-{r.pk}-rejected",
                        "timestamp": e.timestamp.isoformat(),
                        "user": e.user.get_full_name() or e.user.username if e.user else "System",
                        "event_type": "result_rejected",
                        "label": f"Result Rejected — {test_name}",
                        "details": {"test": test_name, "remarks": r.remarks},
                    })

        # 6. Analysis Request completion events
        from lims.models import AnalysisRequest
        completed_ars = AnalysisRequest.objects.filter(sample=sample_obj, status="completed")
        for ar in completed_ars:
            history.append({
                "id": f"ar-{ar.pk}-completed",
                "timestamp": ar.updated_at.isoformat(),
                "user": "System",
                "event_type": "ar_completed",
                "label": f"Analysis Request {ar.ar_id} Completed",
                "details": {"ar_id": ar.ar_id},
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
            # the first one, fall through to the next instead of failing. The
            # occupy is an atomic conditional UPDATE, so no sleep/backoff is
            # needed (and sleeping here would block a Gunicorn worker).
            free_slots = list(
                StorageLocation.objects.filter(parent=loc, location_type="box_location", is_occupied=False)
                .order_by("pk")[:10]
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
        released_client_id = None
        if released_sample_id:
            # instance.save() so the audittrail signals log the release on the Sample.
            from lims.models import Sample, ChainOfCustody
            for _sample in Sample.objects.filter(sample_id=released_sample_id):
                _sample.storage_location = ''
                _sample.save(update_fields=["storage_location", "updated_at"])
                released_client_id = _sample.client_id
                # Real custody handoff out of this slot — mirrors the "stored"
                # row created in _assign_sample_to_slot above.
                ChainOfCustody.objects.create(
                    sample=_sample, action="retrieved", from_location=slot.slot_id,
                    transferred_by=request.user, purpose=f"Retrieved from {slot.slot_id}",
                )

            _queue_sample_storage_transition(released_sample_id, "recover", slot)

        from django.contrib.contenttypes.models import ContentType
        from audittrail.models import AuditEvent
        AuditEvent.objects.create(
            user=request.user,
            action="update",
            content_type=ContentType.objects.get_for_model(slot),
            object_id=slot.pk,
            object_repr=f"Slot {slot.slot_id} unassigned — {slot.name}",
            extra_data={
                "slot_id": slot.slot_id,
                "storage_location_id": slot.pk,
                "sample_id": released_sample_id,
                "client_id": released_client_id,
            },
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

    @action(detail=True, methods=["post"], url_path="retry-sync")
    def retry_sync(self, request, pk=None):
        """Re-dispatch the existing sync task for a location that failed to sync to SENAITE."""
        location = self.get_object()
        from django.db import connection
        from .tasks import sync_storage_location_to_senaite
        sync_storage_location_to_senaite.apply_async(args=[location.pk, connection.schema_name])
        return Response({"message": "Sync retry queued."})

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
    permission_classes = [ReadOnlyOrAnalystOrAbove]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["is_active"]
    search_fields = ["name", "catalog_number", "cas_number"]


class StandardViewSet(viewsets.ModelViewSet):
    queryset = Standard.objects.all()
    serializer_class = StandardSerializer
    permission_classes = [ReadOnlyOrAnalystOrAbove]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["is_active"]
    search_fields = ["name", "catalog_number"]


class SolventViewSet(viewsets.ModelViewSet):
    queryset = Solvent.objects.all()
    serializer_class = SolventSerializer
    permission_classes = [ReadOnlyOrAnalystOrAbove]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["is_active"]
    search_fields = ["name", "catalog_number"]


class LotViewSet(viewsets.ModelViewSet):
    queryset = Lot.objects.select_related("storage_location", "created_by").all()
    serializer_class = LotSerializer
    permission_classes = [ReadOnlyOrAnalystOrAbove]
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
    permission_classes = [ReadOnlyOrAnalystOrAbove]
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
    permission_classes = [ReadOnlyOrAnalystOrAbove]
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
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(ExpiryAlertSerializer(page, many=True).data)
        return Response(ExpiryAlertSerializer(qs, many=True).data)
