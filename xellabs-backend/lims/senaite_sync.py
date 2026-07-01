"""
SENAITE → Django pull sync service.
Polls SENAITE REST API and updates Sample status + Results in Django.
"""
import logging
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


def pull_samples_and_results():
    """
    Main sync entry point.
    Pulls all AnalysisRequests from SENAITE, updates Django Sample status
    and Result values.
    Returns a dict summary: {synced, skipped, errors}
    """
    from lims.models import Sample, AnalysisRequest, Result, WorksheetAssignment, Test

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

        if not client_sample_id:
            skipped += 1
            continue

        # 2. Find matching Django Sample by sample_id (= ClientSampleID in SENAITE)
        try:
            sample = Sample.objects.get(sample_id=client_sample_id)
        except Sample.DoesNotExist:
            logger.debug("No Django sample for SENAITE ClientSampleID=%s", client_sample_id)
            skipped += 1
            continue
        except Sample.MultipleObjectsReturned:
            logger.warning("Multiple samples for ClientSampleID=%s — skipping", client_sample_id)
            errors += 1
            continue

        # 3. Update Sample status + senaite_uid
        new_status = STATUS_MAP.get(review_state, "")
        update_fields = {"last_synced_from_senaite": timezone.now()}

        if senaite_uid and not sample.senaite_uid:
            update_fields["senaite_uid"] = senaite_uid
        if senaite_ar_id and not sample.senaite_ar_id:
            update_fields["senaite_ar_id"] = senaite_ar_id
        if new_status and sample.status != new_status and not sample.is_locked:
            update_fields["status"] = new_status
            logger.info("Sample %s: %s → %s", sample.sample_id, sample.status, new_status)

        Sample.objects.filter(pk=sample.pk).update(**update_fields)

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
        AnalysisRequest, WorksheetAssignment, Result, Test, Worksheet
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

        # Find matching test in Django by name
        test = Test.objects.filter(name__iexact=test_title).first()
        if not test:
            logger.debug("No Django Test matching '%s' — skipping result", test_title)
            continue

        # Find WorksheetAssignment for this test + AR
        wa = WorksheetAssignment.objects.filter(
            analysis_request=django_ar,
            test=test,
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
                "unit": result_unit or test.unit,
                "status": result_status,
                "is_out_of_range": is_out_of_range,
            },
        )

        if not created and not result.is_locked:
            result.value = result_value
            result.unit = result_unit or test.unit
            result.status = result_status
            result.is_out_of_range = is_out_of_range
            result.save(update_fields=["value", "unit", "status", "is_out_of_range"])
            logger.debug("Updated result for %s / %s", sample.sample_id, test_title)
        elif created:
            logger.info("Created result for %s / %s = %s", sample.sample_id, test_title, result_value)
