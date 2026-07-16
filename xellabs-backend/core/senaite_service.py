"""
SENAITE REST API client.
Handles authentication and CRUD operations for clients and analysis requests.
"""
import logging
import requests
from django.conf import settings

logger = logging.getLogger(__name__)

SENAITE_URL      = settings.SENAITE_URL.rstrip("/")
SENAITE_USER     = settings.SENAITE_USER
SENAITE_PASSWORD = settings.SENAITE_PASSWORD


def _session() -> requests.Session:
    s = requests.Session()
    s.auth = (SENAITE_USER, SENAITE_PASSWORD)
    s.headers.update({"Content-Type": "application/json"})
    return s


def _api(path: str) -> str:
    return f"{SENAITE_URL}/@@API/senaite/v1/{path.lstrip('/')}"


# ── Client sync ───────────────────────────────────────────────────────────────

def _client_payload(client) -> dict:
    payload = {
        "title": client.name,
        "ClientID": client.client_id or "",
        "EmailAddress": client.email or "",
        "Phone": client.phone or "",
        "Fax": client.fax or "",
        "MobilePhone": client.mobile or "",
        "TaxNumber": client.tax_number or "",
        "AccountNumber": client.account_number or "",
        "BankName": client.bank_name or "",
        "BankBranch": client.bank_branch or "",
        "SWIFTcode": client.swift_code or "",
        "IBAN": client.iban or "",
        "NIB": client.nib or "",
        "BulkDiscount": str(client.bulk_discount),
        "MemberDiscount": str(client.member_discount),
        "Remarks": client.remarks or "",
    }
    # Contact person
    if client.contact_first_name or client.contact_last_name:
        payload.update({
            "Salutation": client.salutation or "",
            "Firstname": client.contact_first_name or "",
            "Surname": client.contact_last_name or "",
            "contact_EmailAddress": client.contact_email or "",
            "contact_Phone": client.contact_phone or "",
            "JobTitle": client.contact_job_title or "",
            "Department": client.contact_department or "",
        })
    return payload


def push_client(client) -> str | None:
    """
    Create or update client in SENAITE.
    Returns the SENAITE UID on success, None on failure.
    """
    s = _session()
    payload = _client_payload(client)

    try:
        if client.senaite_uid:
            # Update existing via update endpoint
            url = _api(f"update/{client.senaite_uid}")
            resp = s.post(url, json=payload, timeout=15)
        else:
            # Create new via create endpoint with portal_type + parent_path.
            # senaite.jsonapi's find_target_container() does a portal-relative
            # restrictedTraverse() when parent_path doesn't literally start
            # with the portal's own physical path -- a leading-slash path
            # like "/senaite/clients" therefore never matches and 404s with
            # "No target container found" (confirmed live 2026-07-16, this
            # broke every client creation in production). Portal-relative,
            # no leading slash, is what actually resolves.
            payload["portal_type"] = "Client"
            payload["parent_path"] = "clients"
            url = _api("create")
            resp = s.post(url, json=payload, timeout=15)

        resp.raise_for_status()
        data = resp.json()

        # SENAITE's JSON API returns HTTP 200 even on failure (e.g. bad
        # credentials, permission denied) — the real outcome is the body's
        # own `success` flag, not the HTTP status.
        if data.get("success") is False:
            logger.error("SENAITE client sync failed for '%s': %s", client.name, data.get("message") or data)
            return None

        # SENAITE wraps results in {"items": [...]}
        items = data.get("items") or []
        if items:
            uid = items[0].get("uid") or items[0].get("UID")
            logger.info("SENAITE client sync OK: %s → uid=%s", client.name, uid)
            return uid

        logger.warning("SENAITE client sync: unexpected response: %s", data)
        return None

    except requests.RequestException as exc:
        logger.error("SENAITE client sync failed for '%s': %s", client.name, exc)
        return None


# ── Analysis Request sync ─────────────────────────────────────────────────────

def _find_by_title(portal_type: str, title: str) -> dict | None:
    """
    Look up a single SENAITE object by case-insensitive exact title match.
    SENAITE's `title=` query filter is an exact, case-sensitive match server-side,
    so it can't be relied on to find e.g. "Blood Test" vs "Blood test" — instead we
    fetch the full list and match client-side.
    """
    if not title:
        return None
    s = _session()
    try:
        resp = s.get(_api(portal_type), params={"complete": "true", "limit": "1000"}, timeout=15)
        resp.raise_for_status()
        items = resp.json().get("items") or []
        needle = title.strip().lower()
        for item in items:
            if (item.get("title") or "").strip().lower() == needle:
                return item
        return None
    except requests.RequestException as exc:
        logger.error("SENAITE lookup failed for %s '%s': %s", portal_type, title, exc)
        return None


def _find_active_by_title(portal_type: str, title: str) -> dict | None:
    """
    Same as _find_by_title, but only matches ACTIVE objects — an inactive (deleted)
    object with the same title does not count as a duplicate, so it can be re-imported.
    """
    if not title:
        return None
    s = _session()
    try:
        resp = s.get(_api(portal_type), params={"complete": "true", "limit": "1000", "review_state": "active"}, timeout=15)
        resp.raise_for_status()
        items = resp.json().get("items") or []
        needle = title.strip().lower()
        for item in items:
            if (item.get("title") or "").strip().lower() == needle:
                return item
        return None
    except requests.RequestException as exc:
        logger.error("SENAITE active lookup failed for %s '%s': %s", portal_type, title, exc)
        return None


def _ensure_client_contact(client, client_path: str) -> "str | None":
    """
    Every AnalysisRequest requires a Contact — SENAITE re-validates the AR's full
    schema on every 'update' call, including a transition-only payload (confirmed
    via live testing while wiring the senaite.storage store/recover transition:
    every existing AR failed with "Contact is required" because this was never
    set at creation time — a latent gap, since nothing called update() on an AR
    itself until the storage rewire needed to). Reuses the client's existing
    Contact if one exists; creates one from the client's own contact_* fields
    otherwise.
    Filters client-side rather than trusting a `path=` server-side query filter —
    SENAITE list filters have repeatedly been found to silently ignore query
    params instead of erroring (see _find_by_title's docstring / CLAUDE.md), and
    trusting one here would risk creating a duplicate Contact on every sync.
    """
    s = _session()
    try:
        resp = s.get(_api("Contact"), params={"complete": "true", "limit": "1000", "review_state": "active"}, timeout=15)
        resp.raise_for_status()
        for item in resp.json().get("items") or []:
            if item.get("parent_path") == client_path:
                return item.get("uid")
    except requests.RequestException as exc:
        logger.warning("Contact lookup failed for client path '%s': %s", client_path, exc)

    payload = {
        "portal_type": "Contact",
        "parent_path": client_path,
        "Firstname": client.contact_first_name or client.name or "Lab",
        "Surname": client.contact_last_name or "Contact",
    }
    if client.contact_email:
        payload["EmailAddress"] = client.contact_email
    if client.contact_phone:
        payload["BusinessPhone"] = client.contact_phone
    try:
        resp = s.post(_api("create"), json=payload, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        if data.get("success") is False:
            logger.error("Could not create Contact for client path '%s': %s", client_path, data.get("message") or data)
            return None
        items = data.get("items") or []
        return items[0].get("uid") if items else None
    except requests.RequestException as exc:
        logger.error("Could not create Contact for client path '%s': %s", client_path, exc)
        return None


def _find_ar_by_client_sample_id(client_sample_id: str) -> "dict | None":
    """
    Look up an existing AnalysisRequest by its ClientSampleID — set to the
    Django Sample's own (globally unique) sample_id at creation time, see
    push_analysis_request() below — so an exact match means "this Django AR
    was already pushed to SENAITE". Guards push_analysis_request() against
    creating a genuine duplicate AnalysisRequest when it runs again for the
    same AR (e.g. a Celery retry after an earlier create POST actually
    succeeded server-side but the client-side request timed out before
    seeing the response — senaite.jsonapi's create response assembly can be
    slow, confirmed as the live root cause of a real duplicate: one sample
    created in XelLabs produced two AnalysisRequests in SENAITE).
    Client-side filtered for the same reason _find_by_title is — SENAITE's
    server-side query params can't be trusted to actually filter.
    """
    if not client_sample_id:
        return None
    s = _session()
    try:
        resp = s.get(_api("AnalysisRequest"), params={"complete": "true", "limit": "1000"}, timeout=15)
        resp.raise_for_status()
        items = resp.json().get("items") or []
        for item in items:
            if (item.get("ClientSampleID") or "") == client_sample_id:
                return item
        return None
    except requests.RequestException as exc:
        logger.warning("SENAITE AR lookup by ClientSampleID '%s' failed: %s", client_sample_id, exc)
        return None


def push_analysis_request(ar) -> str | None:
    """
    Push an AnalysisRequest + its Sample to SENAITE.
    Returns the SENAITE UID on success, None on failure.
    """
    sample = ar.sample
    client = sample.client

    # Idempotency guard — see _find_ar_by_client_sample_id's docstring for why
    # this matters: without it, any retry of this function (regardless of
    # cause) unconditionally re-creates the AnalysisRequest in SENAITE.
    existing = _find_ar_by_client_sample_id(sample.sample_id)
    if existing and existing.get("uid"):
        logger.info(
            "SENAITE AR sync for %s: found an existing AnalysisRequest (uid=%s) "
            "already created for this sample — reusing it instead of creating a duplicate.",
            ar.ar_id, existing["uid"],
        )
        return existing["uid"]

    if not client.senaite_uid:
        logger.warning(
            "Cannot push AR %s — client '%s' not yet synced to SENAITE.",
            ar.ar_id, client.name,
        )
        return None

    # parent_path must be the client's SENAITE *path* (e.g. /senaite/clients/client-8),
    # not its UID — the create API 404s if given a raw UID here.
    client_item = _find_by_title("client", client.name) or {}
    # Fall back to a direct UID lookup if title matching didn't resolve it.
    client_path = client_item.get("path")
    if not client_path:
        s = _session()
        try:
            resp = s.get(_api("client"), params={"UID": client.senaite_uid, "complete": "true"}, timeout=15)
            resp.raise_for_status()
            items = resp.json().get("items") or []
            client_path = items[0].get("path") if items else None
        except requests.RequestException:
            client_path = None
    if not client_path:
        logger.error("Cannot push AR %s — could not resolve client path in SENAITE.", ar.ar_id)
        return None

    contact_uid = _ensure_client_contact(client, client_path)
    if not contact_uid:
        logger.error("Cannot push AR %s — could not resolve/create a Contact for client '%s'.", ar.ar_id, client.name)
        return None

    # SampleType must be a UID, not a name.
    sample_type_uid = None
    if sample.sample_type:
        st_item = _find_by_title("SampleType", sample.sample_type.name)
        sample_type_uid = st_item.get("uid") if st_item else None
    if not sample_type_uid:
        logger.error(
            "Cannot push AR %s — no SENAITE SampleType matches Django sample type '%s'. "
            "Create a matching Sample Type in SENAITE (Sample Types page) with the exact same name first.",
            ar.ar_id, sample.sample_type.name if sample.sample_type else "(none)",
        )
        return None

    # Analyses must be a list of Analysis Service UIDs — already stored directly
    # on each AnalysisRequestAnalysis row (picked from a live SENAITE services
    # list on the frontend), no name-matching lookup needed anymore.
    analysis_uids = [a.senaite_service_uid for a in ar.analyses.all() if a.senaite_service_uid]
    if not analysis_uids:
        logger.error("Cannot push AR %s — it has no analyses with a SENAITE service UID.", ar.ar_id)
        return None

    from django.utils import timezone

    payload = {
        "portal_type": "AnalysisRequest",
        "parent_path": client_path,
        "Contact": contact_uid,
        "SampleType": sample_type_uid,
        "DateSampled": (sample.collection_date or timezone.now()).isoformat(),
        "ClientSampleID": sample.sample_id,
        "Priority": ar.priority or "normal",
        "Analyses": analysis_uids,
    }

    s = _session()
    try:
        resp = s.post(_api("create"), json=payload, timeout=15)
        resp.raise_for_status()
        data = resp.json()

        # SENAITE's JSON API returns HTTP 200 even on failure (e.g. bad
        # credentials, permission denied) — the real outcome is the body's
        # own `success` flag, not the HTTP status.
        if data.get("success") is False:
            logger.error("SENAITE AR sync failed for '%s': %s", ar.ar_id, data.get("message") or data)
            return None

        items = data.get("items") or []
        if items:
            uid = items[0].get("uid") or items[0].get("UID")
            logger.info("SENAITE AR sync OK: %s → uid=%s", ar.ar_id, uid)
            return uid
        logger.warning("SENAITE AR sync: unexpected response: %s", data)
        return None

    except requests.RequestException as exc:
        logger.error("SENAITE AR sync failed for '%s': %s", ar.ar_id, exc)
        return None


def _build_storage_path(location) -> str:
    """Walk up parent chain to build a human-readable path, e.g. 'Room 1 / Fridge A /
    Shelf 2' — XelLabs-internal display only (denormalized onto Sample.storage_location),
    no longer sent to SENAITE now that real hierarchy objects carry their own path."""
    from inventory.models import StorageLocation
    parts = [location.name]
    current = location
    while current.parent_id:
        try:
            current = StorageLocation.objects.get(id=current.parent_id)
            parts.insert(0, current.name)
        except StorageLocation.DoesNotExist:
            break
    return ' / '.join(parts)


# ── Storage Location sync (senaite.storage add-on) ────────────────────────────
#
# XelLabs' StorageLocation tree maps onto senaite.storage's real content-type
# hierarchy (Strategy pattern — dispatch table instead of an if/elif chain per
# location_type, same shape as ROLE_TO_SENAITE_GROUP below):
#
#   building                 -> StorageFacility          (top-level, own site)
#   room                     -> StoragePosition           (nestable placeholder, building-only)
#   fridge/freezer/cabinet   -> StorageContainer          (has Temperature; nestable)
#   shelf                    -> StorageContainer          (nested under fridge/freezer/cabinet)
#   box                      -> StorageSamplesContainer   (terminal grid: Rows/Columns)
#   box_location (slot)      -> not a separate SENAITE object at all — a slot is
#                               represented inside its box's own PositionsLayout,
#                               so push_storage_location() is a no-op for these
#                               (the signal that queues sync already skips them).
#
# fridge/freezer/cabinet deliberately do NOT map to StoragePosition — confirmed
# live that StoragePosition cannot directly hold a StorageSamplesContainer
# ("Creation of 'StorageSamplesContainer' in '.../SP-xxxxx' is not allowed").
# StorageContainer can hold either another StorageContainer or a
# StorageSamplesContainer directly, so a box always has a valid parent no
# matter how many tiers exist above it. StorageLocation.ALLOWED_PARENT_TYPES
# (inventory/models.py) enforces the same rule at the XelLabs level: a box can
# only be created under fridge/freezer/cabinet/shelf, never under building/room.
STORAGE_ROOT_PATH = "/senaite/senaite_storage"

LOCATION_TYPE_TO_PORTAL_TYPE = {
    "building": "StorageFacility",
    "room": "StoragePosition",
    "fridge": "StorageContainer",
    "freezer": "StorageContainer",
    "cabinet": "StorageContainer",
    "shelf": "StorageContainer",
    "box": "StorageSamplesContainer",
}


def _resolve_path_by_uid(portal_type: str, uid: str) -> "str | None":
    """Fallback UID->path lookup, same pattern already used for the AR's client_path
    fallback — used only if a create response doesn't already include 'path'."""
    s = _session()
    try:
        resp = s.get(_api(portal_type), params={"UID": uid, "complete": "true"}, timeout=15)
        resp.raise_for_status()
        items = resp.json().get("items") or []
        return items[0].get("path") if items else None
    except requests.RequestException:
        return None


def _build_storage_payload(location, portal_type: str) -> dict:
    payload = {
        "title": location.name,
        "description": location.description or "",
    }
    # Only StorageSamplesContainer (box) has a real Rows/Columns grid schema.
    # Only StorageContainer (fridge/freezer/cabinet/shelf) has a real Temperature field.
    # Only StorageFacility (building) has Phone/EmailAddress/Address.
    # StoragePosition (room) has no extra fields beyond title/description.
    if portal_type == "StorageSamplesContainer":
        if location.rows:
            payload["Rows"] = location.rows
        if location.columns:
            payload["Columns"] = location.columns
    elif portal_type == "StorageContainer" and location.temperature is not None:
        payload["Temperature"] = float(location.temperature)
    elif portal_type == "StorageFacility":
        if location.phone:
            payload["Phone"] = location.phone
        if location.email:
            payload["EmailAddress"] = location.email
        if location.address:
            # Address is a compound AddressField (country/state/district/city/zip/
            # address) — XelLabs only tracks one free-text line, so only that
            # sub-key is sent; the rest stay blank until edited directly in SENAITE.
            payload["Address"] = {"address": location.address}
    return payload


def push_storage_location(location) -> "tuple[str | None, str | None]":
    """
    Create or update a StorageLocation node as its mapped senaite.storage content
    object. Returns (uid, path) on success, (None, None) on failure or if this
    location's parent hasn't synced yet (caller's Celery task retries, same as
    before — the parent will have a uid/path by the next attempt).
    box_location (slot) rows are never pushed here — occupancy lives entirely in
    senaite.storage's PositionsLayout on the parent box, not as sibling objects.
    """
    portal_type = LOCATION_TYPE_TO_PORTAL_TYPE.get(location.location_type)
    if not portal_type:
        return None, None

    if location.senaite_uid:
        # Already created — just update title/description/grid size in place.
        s = _session()
        try:
            payload = _build_storage_payload(location, portal_type)
            resp = s.post(_api(f"update/{location.senaite_uid}"), json=payload, timeout=15)
            resp.raise_for_status()
            data = resp.json()
            if data.get("success") is False:
                logger.error("SENAITE storage update failed for '%s': %s", location.name, data.get("message") or data)
                return None, None
            return location.senaite_uid, location.senaite_path
        except Exception as exc:
            logger.error("SENAITE storage update failed for '%s': %s", location.name, exc)
            return None, None

    # Determine parent_path — root Facilities go directly under STORAGE_ROOT_PATH;
    # everything else needs its immediate parent already synced (has both a uid
    # and a cached path) before it can be created as a child of it.
    if location.parent_id:
        parent = location.parent
        if not parent.senaite_uid or not parent.senaite_path:
            logger.info(
                "SENAITE storage sync deferred for '%s' — parent '%s' not yet synced.",
                location.name, parent.name,
            )
            return None, None
        parent_path = parent.senaite_path
    else:
        parent_path = STORAGE_ROOT_PATH

    s = _session()
    try:
        payload = _build_storage_payload(location, portal_type)
        payload["portal_type"] = portal_type
        payload["parent_path"] = parent_path
        resp = s.post(_api("create"), json=payload, timeout=15)
        resp.raise_for_status()
        data = resp.json()

        # SENAITE's JSON API returns HTTP 200 even on failure (e.g. bad
        # credentials, permission denied) — the real outcome is the body's
        # own `success` flag, not the HTTP status.
        if data.get("success") is False:
            logger.error("SENAITE storage sync failed for '%s': %s", location.name, data.get("message") or data)
            return None, None

        items = data.get("items") or []
        if not items:
            logger.warning("SENAITE storage sync: unexpected response for '%s': %s", location.name, data)
            return None, None

        uid = items[0].get("uid") or items[0].get("UID")
        path = items[0].get("path") or (_resolve_path_by_uid(portal_type, uid) if uid else None)
        if not uid or not path:
            logger.warning("SENAITE storage sync: created '%s' but couldn't resolve uid/path: %s", location.name, data)
            return None, None

        logger.info("SENAITE storage sync OK: '%s' (%s) -> %s", location.name, portal_type, path)
        return uid, path

    except Exception as exc:
        logger.error("SENAITE storage sync failed for '%s': %s", location.name, exc)
        return None, None


def set_storage_position(box_uid: str, slot_id: str, ar_uid: str, occupy: bool) -> dict:
    """
    Write (or clear) the occupying sample's AR uid into the exact row/column
    entry of a StorageSamplesContainer's own PositionsLayout — this is what
    makes SENAITE's own storage box view show which slot holds which sample,
    distinct from set_sample_storage_transition() below (which only fires the
    'store'/'recover' workflow transition on the AR itself).

    slot_id is the XelLabs "<Letter><Number>" id (e.g. "A1") — confirmed live
    that this maps to PositionsLayout row=<letter index, A=0>/column=<number-1>.

    Same read-modify-write requirement as set_senaite_group_role()'s roles
    list — PositionsLayout has no partial-update support, so the full array
    must be fetched, the one matching entry mutated, and the whole array sent
    back. Returns {"ok": True} or {"ok": False, "error": ...}. Never raises.
    """
    if not box_uid or not slot_id or not ar_uid:
        return {"ok": False, "error": "Missing box_uid, slot_id, or ar_uid"}
    m = re.match(r"^([A-Za-z])(\d+)$", slot_id)
    if not m:
        return {"ok": False, "error": f"Unrecognized slot id '{slot_id}'"}
    row = ord(m.group(1).upper()) - 65
    column = int(m.group(2)) - 1

    s = _session()
    try:
        resp = s.get(_api("StorageSamplesContainer"), params={"UID": box_uid, "complete": "true"}, timeout=15)
        resp.raise_for_status()
        items = resp.json().get("items") or []
        if not items:
            return {"ok": False, "error": f"Storage box {box_uid} not found"}
        layout = items[0].get("PositionsLayout") or []

        entry = next(
            (e for e in layout if str(e.get("row")) == str(row) and str(e.get("column")) == str(column)),
            None,
        )
        if entry is None:
            return {"ok": False, "error": f"Position row={row}/column={column} not found in box layout"}

        entry["uid"] = ar_uid if occupy else ""
        entry["samples_utilization"] = 1 if occupy else 0

        resp = s.post(_api(f"update/{box_uid}"), json={"PositionsLayout": layout}, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        if data.get("success") is False:
            return {"ok": False, "error": _sanitize_error(str(data.get("message") or data))}
        return {"ok": True}
    except requests.RequestException as exc:
        return {"ok": False, "error": _sanitize_error(str(exc))}


def set_sample_storage_transition(ar_uid: str, transition: str) -> dict:
    """
    Fire the 'store' or 'recover' workflow transition (added to the sample
    workflow by the senaite.storage install) directly on an AnalysisRequest,
    via the same {"transition": ...} update-endpoint mechanism already proven
    in activate_object(). This is what actually reflects a XelLabs slot
    assign/unassign as a real SENAITE sample state change.
    Returns {"ok": True} or {"ok": False, "error": ...}. Never raises.
    """
    if not ar_uid:
        return {"ok": False, "error": "Missing ar_uid"}
    if transition not in ("store", "recover"):
        return {"ok": False, "error": f"Unsupported storage transition '{transition}'"}
    s = _session()
    try:
        resp = s.post(_api(f"update/{ar_uid}"), json={"transition": transition}, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        if data.get("success", True):
            return {"ok": True}
        return {"ok": False, "error": _sanitize_error(str(data.get("message") or data))}
    except Exception as exc:
        return {"ok": False, "error": _sanitize_error(str(exc))}


# ── Master data import (Instruments / Storage Locations) ─────────────────────

import re


def _sanitize_error(message: str) -> str:
    """
    Strip any reference to the underlying SENAITE system (hostnames, URLs, the word
    itself) from an error string before it can reach the frontend/UI. Internal
    logs may say "SENAITE" freely; anything returned in an API response body may not
    — the product is white-labeled as XelLabs end-to-end. See CLAUDE.md Section 17b.
    """
    sanitized = re.sub(r"https?://senaite[^\s'\"]*", "the lab system", message, flags=re.IGNORECASE)
    sanitized = re.sub(r"senaite", "the lab system", sanitized, flags=re.IGNORECASE)
    return sanitized


INSTRUMENTS_PARENT_PATH = "/senaite/bika_setup/bika_instruments"
STORAGE_LOCATIONS_PARENT_PATH = "/senaite/setup/storagelocations"

# SENAITE requires these as UID references on Instrument; auto-created under these
# setup folders if a matching title doesn't already exist.
INSTRUMENT_REFERENCE_FIELDS = {
    "instrumenttype": ("InstrumentType", "/senaite/setup/instrumenttypes"),
    "manufacturer": ("Manufacturer", "/senaite/setup/manufacturers"),
    "supplier": ("Supplier", "/senaite/setup/suppliers"),
}


def _find_or_create(portal_type: str, parent_path: str, title: str) -> str:
    """Look up an existing SENAITE object by title, or create it. Returns its UID."""
    item = _find_by_title(portal_type, title)
    if item and item.get("uid"):
        return item["uid"]

    s = _session()
    resp = s.post(_api("create"), json={
        "portal_type": portal_type,
        "parent_path": parent_path,
        "title": title,
    }, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    if data.get("success") is False:
        raise ValueError(f"Could not create {portal_type} '{title}': {data.get('message') or data}")
    items = data.get("items") or []
    if items:
        return items[0].get("uid") or items[0].get("UID")
    raise ValueError(f"Could not create {portal_type} '{title}': unexpected response {data}")


def import_instrument_row(row: dict) -> dict:
    """
    Create a single SENAITE Instrument from a row dict with (case-insensitive-agnostic,
    caller must lower-case keys) keys: title, instrumenttype, manufacturer, supplier,
    model, serialno, assetnumber.
    Returns {"ok": True, "title": ..., "uid": ...} or {"ok": False, "title": ..., "error": ...}.
    """
    title = (row.get("title") or "").strip()
    if not title:
        return {"ok": False, "title": None, "error": "Missing Title"}

    payload = {
        "portal_type": "Instrument",
        "parent_path": INSTRUMENTS_PARENT_PATH,
        "title": title,
    }
    field_map = {"model": "Model", "serialno": "SerialNo", "assetnumber": "AssetNumber"}
    for field, api_field in field_map.items():
        value = (row.get(field) or "").strip()
        if value:
            payload[api_field] = value

    try:
        for col, (portal_type, parent_path) in INSTRUMENT_REFERENCE_FIELDS.items():
            value = (row.get(col) or "").strip()
            if not value:
                return {"ok": False, "title": title, "error": f"'{col}' is required"}
            payload[portal_type] = _find_or_create(portal_type, parent_path, value)

        # Only skip if an active instrument with this exact title AND every field
        # matches — if even one field differs, this is a distinct record and gets added.
        existing = _find_active_by_title("Instrument", title)
        if existing and _instrument_matches(existing, payload):
            return {"ok": None, "title": title, "error": "Skipped — an identical active instrument already exists"}

        s = _session()
        resp = s.post(_api("create"), json=payload, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        if data.get("success") is False:
            return {"ok": False, "title": title, "error": _sanitize_error(str(data.get("message") or data))}
        items = data.get("items") or []
        if items:
            uid = items[0].get("uid") or items[0].get("UID")
            return {"ok": True, "title": title, "uid": uid}
        return {"ok": False, "title": title, "error": _sanitize_error(f"Unexpected response: {data}")}
    except Exception as exc:
        return {"ok": False, "title": title, "error": _sanitize_error(str(exc))}


def _instrument_matches(existing: dict, payload: dict) -> bool:
    """True only if every comparable field on `existing` equals the incoming `payload`."""
    for field in ("Model", "SerialNo", "AssetNumber"):
        if (existing.get(field) or "") != (payload.get(field) or ""):
            return False
    for field in ("InstrumentType", "Manufacturer", "Supplier"):
        existing_uid = (existing.get(field) or {}).get("uid") if isinstance(existing.get(field), dict) else None
        if existing_uid != payload.get(field):
            return False
    return True


def import_storage_location_row(row: dict) -> dict:
    """
    Create a single SENAITE StorageLocation from a row dict with keys: title, description.
    Returns {"ok": True, "title": ..., "uid": ...} or {"ok": False, "title": ..., "error": ...}.
    """
    title = (row.get("title") or "").strip()
    if not title:
        return {"ok": False, "title": None, "error": "Missing Title"}

    payload = {
        "portal_type": "StorageLocation",
        "parent_path": STORAGE_LOCATIONS_PARENT_PATH,
        "title": title,
    }
    description = (row.get("description") or "").strip()
    if description:
        payload["description"] = description

    # Only skip if an active storage location with this exact title AND description
    # matches — if the description differs, this is a distinct record and gets added.
    existing = _find_active_by_title("StorageLocation", title)
    if existing and (existing.get("description") or "") == (payload.get("description") or ""):
        return {"ok": None, "title": title, "error": "Skipped — an identical active storage location already exists"}

    try:
        s = _session()
        resp = s.post(_api("create"), json=payload, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        if data.get("success") is False:
            return {"ok": False, "title": title, "error": _sanitize_error(str(data.get("message") or data))}
        items = data.get("items") or []
        if items:
            uid = items[0].get("uid") or items[0].get("UID")
            return {"ok": True, "title": title, "uid": uid}
        return {"ok": False, "title": title, "error": _sanitize_error(f"Unexpected response: {data}")}
    except Exception as exc:
        return {"ok": False, "title": title, "error": _sanitize_error(str(exc))}


# In local dev, SENAITE_URL already includes the site path (e.g.
# "http://senaite:8080/senaite"), so the parent path must NOT repeat "/senaite"
# or it 404s ("...senaite/senaite/setup/..." — confirmed live). In production,
# SENAITE_URL points at the host with no site path, so "/senaite" must be
# included here instead. settings.DEBUG (True locally, False in production —
# see config/settings.py) is what distinguishes the two environments.
DYNAMIC_ANALYSIS_SPECS_PARENT_PATH = (
    "/setup/dynamicanalysisspecs" if settings.DEBUG else "/senaite/setup/dynamicanalysisspecs"
)


def push_dynamic_analysis_spec(name: str, summary: str, file_bytes: bytes, filename: str) -> dict:
    """
    Create a SENAITE DynamicAnalysisSpec (an uploaded Excel file of Keyword/
    min/max spec rows). Confirmed live via direct testing that this specific
    content type's file field can ONLY be created through Plone's own native
    REST API (POST to the parent folder path with {"@type": ..., field: {
    "filename", "data": base64, "encoding": "base64", "content-type"}}) —
    senaite.jsonapi's generic create verb does NOT correctly deserialize the
    file field (fails with a base64 "Incorrect padding" error there every
    time), while Plone's native API succeeds cleanly (confirmed via a real
    201 + UID). This is the one object type in this codebase created via
    Plone's REST API instead of senaite.jsonapi.
    Returns {"ok": True, "uid": uid} or {"ok": False, "error": ...}.
    """
    import base64
    s = _session()
    s.headers.update({"Accept": "application/json"})
    try:
        resp = s.post(
            f"{SENAITE_URL}{DYNAMIC_ANALYSIS_SPECS_PARENT_PATH}",
            json={
                "@type": "DynamicAnalysisSpec",
                "title": name,
                "description": summary or "",
                "specs_file": {
                    "filename": filename,
                    "data": base64.b64encode(file_bytes).decode(),
                    "encoding": "base64",
                    "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                },
            },
            timeout=30,
        )
        if resp.status_code not in (200, 201):
            return {"ok": False, "error": _sanitize_error(f"HTTP {resp.status_code}: {resp.text[:300]}")}
        data = resp.json()
        uid = data.get("UID") or data.get("uid")
        if not uid:
            return {"ok": False, "error": _sanitize_error(f"No UID returned: {data}")}
        logger.info("SENAITE DynamicAnalysisSpec created: %s -> uid=%s", name, uid)
        return {"ok": True, "uid": uid}
    except Exception as exc:
        return {"ok": False, "error": _sanitize_error(str(exc))}


def delete_object(uid: str) -> dict:
    """
    Deactivate a SENAITE object by UID (SENAITE's JSON API 'delete' endpoint performs a
    workflow deactivation, not a hard ZODB delete — confirmed via direct testing: the
    object's review_state flips to 'inactive' and it disappears from list queries filtered
    with review_state=active, but the object itself still exists at its original path).
    This is the correct behavior for lab compliance software — records are never truly
    destroyed. Returns {"ok": True, "uid": uid} or {"ok": False, "uid": uid, "error": ...}.
    """
    if not uid:
        return {"ok": False, "uid": uid, "error": "Missing uid"}
    try:
        s = _session()
        resp = s.post(_api("delete"), json={"uid": uid}, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        if data.get("success", True):
            return {"ok": True, "uid": uid}
        return {"ok": False, "uid": uid, "error": _sanitize_error(str(data.get("message") or data))}
    except Exception as exc:
        return {"ok": False, "uid": uid, "error": _sanitize_error(str(exc))}


def activate_object(uid: str) -> dict:
    """
    Reactivate a previously-deactivated SENAITE object by UID — the symmetric
    counterpart to delete_object(). SENAITE's JSON API has no dedicated
    'activate'/'reinstate' endpoint; confirmed via direct testing that posting
    {"transition": "activate"} to the 'update' endpoint fires the workflow
    transition and flips review_state back to 'active'.
    Returns {"ok": True, "uid": uid} or {"ok": False, "uid": uid, "error": ...}.
    """
    if not uid:
        return {"ok": False, "uid": uid, "error": "Missing uid"}
    try:
        s = _session()
        resp = s.post(_api(f"update/{uid}"), json={"transition": "activate"}, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        if data.get("success", True):
            return {"ok": True, "uid": uid}
        return {"ok": False, "uid": uid, "error": _sanitize_error(str(data.get("message") or data))}
    except Exception as exc:
        return {"ok": False, "uid": uid, "error": _sanitize_error(str(exc))}


# ── Staff user sync ────────────────────────────────────────────────────────────

# Maps our internal User.role to the matching SENAITE Group id (confirmed via
# GET /@groups — each group's `roles` list is what actually grants SENAITE
# permissions, e.g. Analysts -> ['Analyst', 'Authenticated']). 'client' is
# intentionally excluded: Client accounts are never created via this staff
# flow (see UserViewSet docstring).
ROLE_TO_SENAITE_GROUP = {
    "admin": "Administrators",
    "lab_manager": "LabManagers",
    "analyst": "Analysts",
    "reviewer": "Reviewers",
    "receptionist": "LabClerks",
}


def _plone_rest_api(path: str) -> str:
    """Plone's own REST API (@users, @groups) — distinct from senaite.jsonapi's
    /@@API/senaite/v1/ used by _api(). Both live on the same SENAITE_URL."""
    return f"{SENAITE_URL}/{path.lstrip('/')}"


def push_staff_user(user, temp_password: str) -> dict:
    """
    Create a matching SENAITE member account for a newly-created Django staff
    user, and add them to the SENAITE Group matching their internal role so
    they get real SENAITE permissions (e.g. an 'analyst' can submit results).
    Uses Plone's own @users/@groups REST API (confirmed working via direct
    testing — plone.restapi, not senaite.jsonapi), not the senaite.jsonapi
    v1 endpoints used elsewhere in this module.

    Unlike senaite.jsonapi, Plone's own @users/@groups services require an
    explicit `Accept: application/json` header for content-negotiation-based
    traversal to route to them at all (missing it -> 404 NotFound). That
    header was deliberately removed from _session()'s defaults by an earlier
    fix because it broke senaite.jsonapi POSTs elsewhere — so it's set here
    as a per-call override instead of touching the shared session.

    Returns {"ok": True} or {"ok": False, "error": ...}. Never raises —
    a SENAITE-side failure must never block Django staff-user creation.
    """
    group = ROLE_TO_SENAITE_GROUP.get(user.role)
    if not group:
        return {"ok": False, "error": f"No SENAITE group mapping for role '{user.role}'"}

    s = _session()
    plone_headers = {"Accept": "application/json"}
    try:
        resp = s.post(_plone_rest_api("@users"), json={
            "username": user.username,
            "email": user.email or "",
            "password": temp_password,
            "roles": [],
        }, headers=plone_headers, timeout=15)
        if resp.status_code not in (200, 201):
            # "login name already in use" is permanent, not transient — most often
            # this Django username collides with SENAITE's OWN built-in service
            # account (SENAITE_USER, "admin" by default — see ROLE_TO_SENAITE_GROUP
            # note below), which is a Zope root/emergency user, not a normal Member,
            # so it never appears in list_senaite_users() yet still reserves the
            # name. Retrying this on a timer can never succeed — flag it so the
            # caller (sync_staff_user_to_senaite) doesn't burn retries on it.
            permanent = resp.status_code == 400 and "already in use" in resp.text.lower()
            return {
                "ok": False,
                "error": _sanitize_error(f"User create failed: HTTP {resp.status_code} {resp.text[:200]}"),
                "permanent": permanent,
            }

        resp = s.patch(_plone_rest_api(f"@groups/{group}"), json={
            "users": {user.username: True}
        }, headers=plone_headers, timeout=15)
        if resp.status_code not in (200, 204):
            return {"ok": False, "error": _sanitize_error(f"Group assign failed: HTTP {resp.status_code} {resp.text[:200]}")}

        logger.info("SENAITE user sync OK: %s -> group %s", user.username, group)
        return {"ok": True}
    except requests.RequestException as exc:
        return {"ok": False, "error": _sanitize_error(str(exc))}


# Every SENAITE role a user can be granted directly (the columns on the
# "Users and Groups" -> Users matrix in SENAITE itself). Kept as one ordered
# list so the frontend table and any backend validation share the same set.
SENAITE_USER_ROLES = [
    "Analyst", "Client", "LabClerk", "LabManager", "Preserver", "Publisher",
    "RegulatoryInspector", "Sampler", "SamplingCoordinator", "Verifier", "Manager",
]


def list_senaite_users() -> list[dict]:
    """
    Fetch every SENAITE member with their current effective roles, in one bulk
    call (GET /@users returns `roles` per user already — confirmed via direct
    testing, no need for a per-user follow-up call).
    Returns [] on any failure — a SENAITE outage must never break the Users page.
    """
    s = _session()
    try:
        resp = s.get(_plone_rest_api("@users"), headers={"Accept": "application/json"}, timeout=15)
        resp.raise_for_status()
        return [
            {
                "username": u.get("username") or u.get("id"),
                "email": u.get("email") or "",
                "fullname": u.get("fullname") or "",
                "roles": u.get("roles") or [],
            }
            for u in resp.json()
        ]
    except requests.RequestException as exc:
        logger.error("list_senaite_users failed: %s", _sanitize_error(str(exc)))
        return []


def list_senaite_groups() -> list[dict]:
    """
    Fetch every SENAITE group with its current role grants and member count
    (GET /@groups returns `roles` and `users` per group already — confirmed
    via direct testing, no need for a per-group follow-up call).
    Returns [] on any failure — a SENAITE outage must never break the Groups page.
    """
    s = _session()
    try:
        resp = s.get(_plone_rest_api("@groups"), headers={"Accept": "application/json"}, timeout=15)
        resp.raise_for_status()
        return [
            {
                "id": g.get("id") or g.get("groupname"),
                "title": g.get("title") or g.get("id") or g.get("groupname"),
                "roles": g.get("roles") or [],
                "member_count": len(g.get("users") or []),
            }
            for g in resp.json()
        ]
    except requests.RequestException as exc:
        logger.error("list_senaite_groups failed: %s", _sanitize_error(str(exc)))
        return []


def create_senaite_group(group_id: str, title: str = "") -> dict:
    """
    Create a new SENAITE group (Plone @groups POST) — the same operation as
    SENAITE's own "Add New Group" button. Returns {"ok": True} or
    {"ok": False, "error": ...}.
    """
    s = _session()
    try:
        resp = s.post(
            _plone_rest_api("@groups"),
            json={"groupname": group_id, "title": title or group_id},
            headers={"Accept": "application/json"},
            timeout=15,
        )
        if resp.status_code not in (200, 201):
            return {"ok": False, "error": _sanitize_error(f"HTTP {resp.status_code} {resp.text[:200]}")}
        return {"ok": True}
    except requests.RequestException as exc:
        return {"ok": False, "error": _sanitize_error(str(exc))}


def delete_senaite_group(group_id: str) -> dict:
    """Delete a SENAITE group (Plone @groups DELETE)."""
    s = _session()
    try:
        resp = s.delete(
            _plone_rest_api(f"@groups/{group_id}"),
            headers={"Accept": "application/json"},
            timeout=15,
        )
        if resp.status_code not in (200, 204):
            return {"ok": False, "error": _sanitize_error(f"HTTP {resp.status_code} {resp.text[:200]}")}
        return {"ok": True}
    except requests.RequestException as exc:
        return {"ok": False, "error": _sanitize_error(str(exc))}


def set_senaite_group_role(group_id: str, role: str, enabled: bool) -> dict:
    """
    Grant or revoke a single SENAITE role on a group (the exact operation
    SENAITE's own Groups-matrix checkboxes perform).

    Unlike @users/<username> (where PATCH {"roles": {role: bool}} is a diff
    against the user's current roles — confirmed in set_senaite_user_role),
    @groups/<id> silently no-ops on that same dict-diff shape (returns 204 but
    the role list is unchanged — confirmed via direct testing toggling a role
    off and re-fetching the group). Groups instead require the full desired
    `roles` list, so this reads the group's current roles first and PATCHes
    the whole list back with just this one role added/removed.
    Returns {"ok": True} or {"ok": False, "error": ...}.
    """
    if role not in SENAITE_USER_ROLES:
        return {"ok": False, "error": f"Unknown SENAITE role '{role}'"}
    s = _session()
    try:
        resp = s.get(_plone_rest_api(f"@groups/{group_id}"), headers={"Accept": "application/json"}, timeout=15)
        resp.raise_for_status()
        current_roles = set(resp.json().get("roles") or [])
        if enabled:
            current_roles.add(role)
        else:
            current_roles.discard(role)

        resp = s.patch(
            _plone_rest_api(f"@groups/{group_id}"),
            json={"roles": sorted(current_roles)},
            headers={"Accept": "application/json"},
            timeout=15,
        )
        if resp.status_code not in (200, 204):
            return {"ok": False, "error": _sanitize_error(f"HTTP {resp.status_code} {resp.text[:200]}")}
        return {"ok": True}
    except requests.RequestException as exc:
        return {"ok": False, "error": _sanitize_error(str(exc))}


def set_senaite_user_role(username: str, role: str, enabled: bool) -> dict:
    """
    Grant or revoke a single SENAITE role directly on a user (the exact
    operation SENAITE's own Users-matrix checkboxes perform) — confirmed via
    direct testing that PATCH /@users/<username> {"roles": {role: bool}} is a
    diff against the user's current roles, not a full replace, so toggling
    one checkbox never touches any of the user's other roles.
    Returns {"ok": True} or {"ok": False, "error": ...}.
    """
    if role not in SENAITE_USER_ROLES:
        return {"ok": False, "error": f"Unknown SENAITE role '{role}'"}
    s = _session()
    try:
        resp = s.patch(
            _plone_rest_api(f"@users/{username}"),
            json={"roles": {role: enabled}},
            headers={"Accept": "application/json"},
            timeout=15,
        )
        if resp.status_code not in (200, 204):
            return {"ok": False, "error": _sanitize_error(f"HTTP {resp.status_code} {resp.text[:200]}")}
        return {"ok": True}
    except requests.RequestException as exc:
        return {"ok": False, "error": _sanitize_error(str(exc))}
