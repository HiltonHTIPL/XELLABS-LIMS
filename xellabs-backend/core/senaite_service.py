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
    s.headers.update({"Accept": "application/json", "Content-Type": "application/json"})
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
    # Addresses
    if client.physical_address:
        payload["PhysicalAddress"] = client.physical_address
    if client.postal_address:
        payload["PostalAddress"] = client.postal_address
    if client.billing_address:
        payload["BillingAddress"] = client.billing_address
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
