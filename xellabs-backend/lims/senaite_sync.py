"""
SENAITE → Django pull sync service.
Polls SENAITE REST API and updates Sample status + Results in Django.
"""
import logging
from django.db import transaction
from django.utils import timezone
import requests
from django.conf import settings

logger = logging.getLogger(__name__)


def _senaite_creds():
    return (
        getattr(settings, "SENAITE_URL", "").rstrip("/"),
        getattr(settings, "SENAITE_USER", "admin"),
        getattr(settings, "SENAITE_PASSWORD", "admin"),
    )

# SENAITE review_state → Django Sample.status
STATUS_MAP = {
    "sample_registered":  "registered",
    "sample_due":         "registered",
    "sample_received":    "received",
    "assigned":           "in_progress",
    "unassigned":         "in_progress",
    "attachment_due":     "in_progress",
    "to_be_verified":     "results_pending",
    "verified":           "reviewed",
    "published":          "published",
    "cancelled":          "rejected",
    "rejected":           "rejected",
    "retracted":          "rejected",
    "invalid":            "rejected",
}

# Forward-only ordering of the lab-progress stages (Django owns the worksheet
# stages in_progress/results_pending/reviewed; SENAITE's AR just sits at
# sample_received while worksheets run). A sync must never move a sample
# backwards through these.
STATUS_RANK = {"registered": 0, "received": 1, "in_progress": 2,
               "results_pending": 3, "reviewed": 4, "published": 5}


def _session() -> requests.Session:
    _, user, password = _senaite_creds()
    s = requests.Session()
    s.auth = (user, password)
    s.headers.update({"Accept": "application/json"})
    return s


def _api(path: str) -> str:
    url, _, _ = _senaite_creds()
    return f"{url}/@@API/senaite/v1/{path.lstrip('/')}"


def _get_all_pages(session, url, params=None) -> list:
    """Fetch all pages from a paginated SENAITE endpoint."""
    results = []
    params = params or {}
    params.setdefault("limit", 25)
    params["b_start"] = 0

    while True:
        try:
            resp = session.get(url, params=params, timeout=20)
            resp.raise_for_status()
            data = resp.json()
        except requests.RequestException as exc:
            logger.error("SENAITE API error at %s: %s", url, exc)
            break

        items = data.get("items", [])
        results.extend(items)

        total = data.get("total", 0)
        if len(results) >= total or not items:
            break
        params["b_start"] += len(items)

    return results


def _fetch_ar(session, ar_uid):
    """Fetch a single AnalysisRequest by uid → its item dict (or None)."""
    try:
        r = session.get(f"{_api('AnalysisRequest')}/{ar_uid}", params={"complete": "true"}, timeout=20)
        r.raise_for_status()
        items = r.json().get("items", [])
        return items[0] if items else None
    except requests.RequestException as exc:
        logger.error("refresh: AR fetch failed for %s: %s", ar_uid, exc)
        return None


def refresh_one_sample_status(ar_uid: str = "", analysis_uid: str = "") -> dict:
    """On-demand single-sample status sync (the synchronous counterpart of the
    5-min pull task). Reads one sample's live SENAITE review_state and updates
    its Django Sample.status (forward-only), matched by senaite_uid/senaite_ar_id.
    Accepts an AnalysisRequest uid, OR an Analysis uid (resolves its parent AR —
    used by worksheet result/verify actions, which act on analyses).
    Returns {uid, sample_id, status, review_state} or {error}.
    """
    from django.db.models import Q
    from lims.models import Sample

    url, _, _ = _senaite_creds()
    if not url:
        return {"error": "SENAITE_URL not configured"}
    session = _session()

    # Resolve an analysis uid up to its parent AR.
    if not ar_uid and analysis_uid:
        try:
            r = session.get(f"{_api('Analysis')}/{analysis_uid}", params={"complete": "true"}, timeout=20)
            r.raise_for_status()
            items = r.json().get("items", [])
            if items:
                ar_uid = items[0].get("getRequestUID") or items[0].get("getParentUID") or ""
        except requests.RequestException as exc:
            return {"error": f"analysis lookup failed: {exc}"}
    if not ar_uid:
        return {"error": "no AnalysisRequest uid"}

    ar = _fetch_ar(session, ar_uid)
    if not ar:
        return {"error": "AnalysisRequest not found"}

    review_state = ar.get("review_state", "")
    senaite_ar_id = ar.get("id", "")
    new_status = STATUS_MAP.get(review_state, "")
    if not new_status:
        return {"error": f"unmapped review_state '{review_state}'", "review_state": review_state}

    with transaction.atomic():
        sample = (Sample.objects.select_for_update()
                  .filter(Q(senaite_uid=ar_uid) | Q(senaite_ar_id=senaite_ar_id))
                  .first())
        if not sample:
            return {"error": "no matching Django sample", "review_state": review_state}

        changed = ["last_synced_from_senaite"]
        sample.last_synced_from_senaite = timezone.now()
        if not sample.senaite_uid:
            sample.senaite_uid = ar_uid
            changed.append("senaite_uid")
        moves_forward = (
            new_status not in STATUS_RANK or sample.status not in STATUS_RANK
            or STATUS_RANK[new_status] > STATUS_RANK[sample.status]
        )
        if sample.status != new_status and not sample.is_locked and moves_forward:
            logger.info("refresh %s: %s → %s", sample.sample_id, sample.status, new_status)
            sample.status = new_status
            changed.append("status")
        sample.save(update_fields=changed)
        return {"uid": ar_uid, "sample_id": sample.sample_id, "status": sample.status, "review_state": review_state}


def pull_samples_and_results():
    """
    Main sync entry point.
    Pulls all AnalysisRequests from SENAITE, updates Django Sample status
    and Result values.
    Returns a dict summary: {synced, skipped, errors}
    """
    from lims.models import Sample, AnalysisRequest, Result, WorksheetAssignment

    senaite_url, _, _ = _senaite_creds()
    if not senaite_url:
        logger.warning("SENAITE_URL not configured — skipping sync.")
        return {"synced": 0, "skipped": 0, "errors": 0}

    session = _session()
    synced = skipped = errors = 0

    # 1. Pull all AnalysisRequests from SENAITE
    ar_items = _get_all_pages(session, _api("AnalysisRequest"))
    logger.info("SENAITE sync: fetched %d AnalysisRequests", len(ar_items))

    for ar_data in ar_items:
        senaite_uid = ar_data.get("uid") or ar_data.get("UID", "")
        client_sample_id = ar_data.get("ClientSampleID", "")
        review_state = ar_data.get("review_state", "")
        senaite_ar_id = ar_data.get("id", "")

        # 2. Match the Django Sample by SENAITE uid → id → ClientSampleID.
        # uid/id are always present and stable; ClientSampleID frequently isn't
        # set, which previously made this sync silently skip most samples.
        from django.db.models import Q
        match = Q()
        if senaite_uid:
            match |= Q(senaite_uid=senaite_uid)
        if senaite_ar_id:
            match |= Q(senaite_ar_id=senaite_ar_id)
        if client_sample_id:
            match |= Q(sample_id=client_sample_id)
        if not match:
            skipped += 1
            continue

        with transaction.atomic():
            sample = Sample.objects.select_for_update().filter(match).first()
            if sample is None:
                skipped += 1
                continue

            # 3. Update Sample status + senaite ids (forward-only)
            new_status = STATUS_MAP.get(review_state, "")
            changed_fields = ["last_synced_from_senaite"]
            sample.last_synced_from_senaite = timezone.now()

            if senaite_uid and not sample.senaite_uid:
                sample.senaite_uid = senaite_uid
                changed_fields.append("senaite_uid")
            if senaite_ar_id and not sample.senaite_ar_id:
                sample.senaite_ar_id = senaite_ar_id
                changed_fields.append("senaite_ar_id")
            moves_forward = (
                new_status not in STATUS_RANK or sample.status not in STATUS_RANK
                or STATUS_RANK[new_status] > STATUS_RANK[sample.status]
            )
            if new_status and sample.status != new_status and not sample.is_locked and moves_forward:
                logger.info("Sample %s: %s → %s", sample.sample_id, sample.status, new_status)
                sample.status = new_status
                changed_fields.append("status")

            sample.save(update_fields=changed_fields)

        # 4. Pull analyses (results) for this AR
        ar_uid = senaite_uid
        if ar_uid:
            _sync_results(session, sample, ar_uid)

        synced += 1

    logger.info(
        "SENAITE sync complete — synced=%d skipped=%d errors=%d",
        synced, skipped, errors,
    )
    return {"synced": synced, "skipped": skipped, "errors": errors}


def _sync_results(session, sample, ar_uid: str):
    """
    Pull analyses from a single SENAITE AnalysisRequest and
    update/create Result records in Django.
    """
    from lims.models import (
        AnalysisRequest, WorksheetAssignment, Result, Worksheet
    )
    from django.contrib.auth import get_user_model
    User = get_user_model()

    try:
        resp = session.get(_api(f"AnalysisRequest/{ar_uid}"), timeout=15)
        resp.raise_for_status()
        ar_data = resp.json()
    except requests.RequestException as exc:
        logger.error("Failed to fetch AR detail for uid=%s: %s", ar_uid, exc)
        return

    # SENAITE returns AR detail; analyses are nested or linked
    analyses = ar_data.get("Analyses", [])
    if not analyses:
        return

    # Find the Django AnalysisRequest linked to this sample
    django_ar = AnalysisRequest.objects.filter(sample=sample).first()
    if not django_ar:
        return

    for analysis in analyses:
        # analysis is a dict or a URL — fetch if URL
        if isinstance(analysis, str):
            try:
                r = session.get(analysis, timeout=10)
                r.raise_for_status()
                analysis = r.json()
            except requests.RequestException:
                continue

        test_title = analysis.get("title", "")
        result_value = analysis.get("Result", "") or ""
        result_unit = analysis.get("Unit", "") or ""
        ana_state = analysis.get("review_state", "")
        is_out_of_range = bool(analysis.get("OutOfRange", False))

        if not test_title:
            continue

        # Map SENAITE analysis review_state → Django Result.status
        result_status_map = {
            "unassigned":     "pending",
            "assigned":       "pending",
            "to_be_verified": "submitted",
            "verified":       "verified",
            "published":      "verified",
        }
        result_status = result_status_map.get(ana_state, "pending")

        # Find WorksheetAssignment for this analysis + AR, locking it against a
        # concurrent instrument-import task writing to the same Result.
        # Matched by SENAITE service name directly (no Django Test mirror
        # table anymore — SENAITE is the sole source of truth for analyses).
        with transaction.atomic():
            wa = WorksheetAssignment.objects.select_for_update().filter(
                analysis_request=django_ar,
                senaite_service_name__iexact=test_title,
            ).first()

            if not wa:
                logger.debug(
                    "No WorksheetAssignment for AR %s / test '%s' — skipping",
                    django_ar.ar_id, test_title,
                )
                continue

            # Create or update the Result
            result, created = Result.objects.get_or_create(
                worksheet_assignment=wa,
                defaults={
                    "value": result_value,
                    "unit": result_unit,
                    "status": result_status,
                    "is_out_of_range": is_out_of_range,
                },
            )

            if not created and not result.is_locked:
                result.value = result_value
                result.unit = result_unit
                result.status = result_status
                result.is_out_of_range = is_out_of_range
                # Automated SENAITE poll, not a manual user edit — tag the audit source.
                result._audit_source = "api"
                result.save(update_fields=["value", "unit", "status", "is_out_of_range"])
                logger.debug("Updated result for %s / %s", sample.sample_id, test_title)
            elif created:
                logger.info("Created result for %s / %s = %s", sample.sample_id, test_title, result_value)
