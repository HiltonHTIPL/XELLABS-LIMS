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
            # Create new via create endpoint with portal_type + parent_path
            payload["portal_type"] = "Client"
            payload["parent_path"] = "/senaite/clients"
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


def push_analysis_request(ar) -> str | None:
    """
    Push an AnalysisRequest + its Sample to SENAITE.
    Returns the SENAITE UID on success, None on failure.
    """
    sample = ar.sample
    client = sample.client

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

    # Analyses must be a list of Analysis Service UIDs, not {"title": ...} objects.
    analysis_uids = []
    missing_tests = []
    for test in ar.tests.all():
        svc = _find_by_title("AnalysisService", test.name)
        if svc and svc.get("uid"):
            analysis_uids.append(svc["uid"])
        else:
            missing_tests.append(test.name)
    if missing_tests:
        logger.warning(
            "AR %s: no SENAITE Analysis Service found for test(s) %s — create them in SENAITE "
            "(Setup > Analysis Services) with a title exactly matching the Test name.",
            ar.ar_id, missing_tests,
        )
    if not analysis_uids:
        logger.error("Cannot push AR %s — none of its tests have a matching SENAITE Analysis Service.", ar.ar_id)
        return None

    from django.utils import timezone

    payload = {
        "portal_type": "AnalysisRequest",
        "parent_path": client_path,
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


# ── Storage Location sync ─────────────────────────────────────────────────────

def _build_storage_path(location) -> str:
    """Walk up parent chain to build full path, e.g. 'Room 1 / Fridge A / Shelf 2'."""
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


def _build_senaite_payload(location, title: str) -> dict:
    payload = {
        "title": title,
        "description": location.description or "",
    }
    for field in [
        "address", "site_title", "site_code", "site_description",
        "location_title", "location_code", "location_description",
        "shelf_title", "shelf_code", "shelf_description",
    ]:
        val = getattr(location, field, "")
        if val:
            payload[field] = val
    if location.senaite_location_type:
        payload["location_type"] = location.senaite_location_type
    return payload


def push_storage_location(location) -> "str | None":
    """
    Create or update a StorageLocation in SENAITE.
    Returns SENAITE UID on success, None on failure (non-fatal).
    """
    s = _session()
    title = _build_storage_path(location)

    try:
        payload = _build_senaite_payload(location, title)

        if location.senaite_uid:
            resp = s.post(_api(f"update/{location.senaite_uid}"), json=payload, timeout=15)
        else:
            payload["portal_type"] = "StorageLocation"
            payload["parent_path"] = "/senaite/setup/storagelocations"
            resp = s.post(_api("create"), json=payload, timeout=15)

        resp.raise_for_status()
        data = resp.json()

        # SENAITE's JSON API returns HTTP 200 even on failure (e.g. bad
        # credentials, permission denied) — the real outcome is the body's
        # own `success` flag, not the HTTP status.
        if data.get("success") is False:
            logger.error("SENAITE storage sync failed for '%s': %s", title, data.get("message") or data)
            return None

        items = data.get("items") or []
        if items:
            uid = items[0].get("uid") or items[0].get("UID")
            logger.info("SENAITE storage sync OK: '%s' -> uid=%s", title, uid)
            return uid

        logger.warning("SENAITE storage sync: unexpected response for '%s': %s", title, data)
        return None

    except Exception as exc:
        logger.error("SENAITE storage sync failed for '%s': %s", title, exc)
        return None


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
            return {"ok": False, "error": _sanitize_error(f"User create failed: HTTP {resp.status_code} {resp.text[:200]}")}

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
