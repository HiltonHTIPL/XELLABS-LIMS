# -*- coding: utf-8 -*-
"""
Custom JSON views for the SENAITE Worksheet flow, baked into the senaite.core
egg (same pattern/escape-hatch as calculation_views.py and
client_address_views.py).

The running SENAITE 2.6.0 Worksheet is an Archetypes type whose schema marks the
`Analyses` field as required. plone.restapi / senaite.jsonapi therefore cannot
create one: both deserializers run validate_all=True and reject the *empty*
create that the native flow actually performs. SENAITE's own AddWorksheetView
creates an EMPTY worksheet via `_createObjectByType("Worksheet", ...)` +
`processForm()`, then adds analyses / applies a Worksheet Template afterwards —
never invoking that required-field validator. These views replicate exactly that
server-side flow and return JSON, so the frontend can create worksheets and
apply Worksheet Templates over plain HTTP.

Confirmed empirically against the live 2.6.0 instance: generic REST create fails
with `{"Analyses": "Analyses is required"}`; this path (the native create) does
not. `applyWorksheetTemplate(wst)` is SENAITE's own method — it fills routine
slots from unassigned analyses, creates duplicate analyses, and creates
blank/control reference analyses from ReferenceSamples — so we call it directly
rather than reimplementing any of that layout/QC logic (KISS: reuse the engine).
"""
import json

from bika.lims import api
from bika.lims.api.analysis import is_out_of_range
from bika.lims.utils import tmpID
from Products.CMFPlone.utils import _createObjectByType
from Products.Five.browser import BrowserView


def _read_body(request):
    try:
        return json.loads(request.get("BODY", "{}") or "{}")
    except ValueError:
        return None


def _obj_or_none(uid):
    if not uid:
        return None
    try:
        return api.get_object_by_uid(uid)
    except Exception:
        return None


def _analysis_info(analysis):
    request = None
    if hasattr(analysis, "getRequest"):
        try:
            request = analysis.getRequest()
        except Exception:
            request = None
    # QC analyses (Blank/Control) have no Request — getRequest() returns None
    # for them since their real parent is a ReferenceSample, not an
    # AnalysisRequest. Fall back to the analysis's own physical parent, which
    # is always correct regardless of type (an Analysis lives inside its AR,
    # a ReferenceAnalysis lives inside its ReferenceSample) — this shows the
    # QC material's own SENAITE id (e.g. "QC-SOILMIN-2026-001") in the same
    # "sample" slot a routine row uses for its real sample id.
    if request is None:
        try:
            parent = api.get_parent(analysis)
            if parent is not None and api.get_portal_type(parent) != "Worksheet":
                request = parent
        except Exception:
            request = None
    result = ""
    if hasattr(analysis, "getResult"):
        try:
            result = analysis.getResult()
        except Exception:
            result = ""
    # Interim fields (e.g. CA/MG for "Soil Calcium and Magnesium") only exist
    # when the Analysis Service configured a Calculation with them — most
    # analyses have none, so this stays an empty list. See
    # analysis_calculate_view.py for how these get turned into a computed
    # Result via SENAITE's own calculateResult() engine.
    interim_fields = []
    if hasattr(analysis, "getInterimFields"):
        try:
            interim_fields = analysis.getInterimFields() or []
        except Exception:
            interim_fields = []
    calculation = None
    if hasattr(analysis, "getCalculation"):
        try:
            calculation = analysis.getCalculation()
        except Exception:
            calculation = None

    # Grading flags - only meaningful once a result has been entered, and
    # only computed from real SENAITE mechanisms (never guessed/derived
    # client-side): is_out_of_range() works uniformly for both a routine
    # Analysis (graded against its own ResultsRange, pushed by
    # @@set-results-range from our Django-side Specification) and a QC
    # ReferenceAnalysis (graded against its ReferenceSample's own
    # ReferenceResults) - confirmed by reading bika/lims/api/analysis.py.
    # Detection/quantification limit flags come straight from the Analysis
    # Service's own configured thresholds.
    out_of_range = False
    below_lod = False
    above_udl = False
    below_loq = False
    above_uoq = False
    if result not in (None, ""):
        try:
            out_of_range, _ = is_out_of_range(analysis)
        except Exception:
            out_of_range = False
        for attr, box in (
            ("isBelowLowerDetectionLimit", "below_lod"),
            ("isAboveUpperDetectionLimit", "above_udl"),
            ("isBelowLimitOfQuantification", "below_loq"),
            ("isAboveLimitOfQuantification", "above_uoq"),
        ):
            if hasattr(analysis, attr):
                try:
                    value = getattr(analysis, attr)()
                except Exception:
                    value = False
                if box == "below_lod":
                    below_lod = value
                elif box == "above_udl":
                    above_udl = value
                elif box == "below_loq":
                    below_loq = value
                elif box == "above_uoq":
                    above_uoq = value

    return {
        "uid": api.get_uid(analysis),
        "id": api.get_id(analysis),
        "path": analysis.absolute_url_path(),
        "title": analysis.Title(),
        "keyword": analysis.getKeyword() if hasattr(analysis, "getKeyword") else "",
        "portal_type": analysis.portal_type,
        "review_state": api.get_review_status(analysis),
        "result": result if result is not None else "",
        "sample_id": api.get_id(request) if request else "",
        "sample_uid": api.get_uid(request) if request else "",
        "interim_fields": interim_fields,
        "calculation_uid": api.get_uid(calculation) if calculation else "",
        "out_of_range": bool(out_of_range),
        "below_lod": bool(below_lod),
        "above_udl": bool(above_udl),
        "below_loq": bool(below_loq),
        "above_uoq": bool(above_uoq),
    }


def _serialize(ws):
    slots = []
    for row in (ws.getLayout() or []):
        analysis = _obj_or_none(row.get("analysis_uid"))
        slots.append({
            "position": row.get("position"),
            "type": row.get("type"),
            "container_uid": row.get("container_uid"),
            "analysis_uid": row.get("analysis_uid"),
            "analysis": _analysis_info(analysis) if analysis else None,
        })
    instrument = ws.getInstrument()
    method = ws.getMethod()
    try:
        remarks = ws.getRemarks()
        remarks = remarks if isinstance(remarks, basestring) else str(remarks or "")
    except Exception:
        remarks = ""
    return {
        "success": True,
        "uid": api.get_uid(ws),
        "id": api.get_id(ws),
        "url": ws.absolute_url_path(),
        "analyst": ws.getAnalyst() or "",
        "instrument_uid": api.get_uid(instrument) if instrument else "",
        "instrument_title": instrument.Title() if instrument else "",
        "method_uid": api.get_uid(method) if method else "",
        "method_title": method.Title() if method else "",
        "remarks": remarks,
        "template_uid": ws.getWorksheetTemplateUID() or "",
        "template_title": ws.getWorksheetTemplateTitle() or "",
        "review_state": api.get_review_status(ws),
        "num_regular_analyses": ws.getNumberOfRegularAnalyses(),
        "num_qc_analyses": ws.getNumberOfQCAnalyses(),
        "layout": slots,
        "created": ws.created().ISO8601() if ws.created() else "",
    }


class CreateWorksheetView(BrowserView):
    """POST {analyst?, instrument?, template?} to
    <worksheets-folder-url>/@@create-worksheet.

    Creates an (empty) Worksheet the same way SENAITE's AddWorksheetView does,
    sets analyst / instrument / results-layout, and applies the given Worksheet
    Template (auto-filling routine + QC + duplicate slots) when a template uid
    is supplied. Returns the serialized worksheet.
    """

    def __call__(self):
        self.request.response.setHeader("Content-Type", "application/json")
        payload = _read_body(self.request)
        if payload is None:
            self.request.response.setStatus(400)
            return json.dumps({"success": False, "error": "Invalid JSON body"})

        analyst = payload.get("analyst") or api.get_current_user().id
        instrument_uid = payload.get("instrument") or ""
        template_uid = payload.get("template") or ""

        try:
            ws = _createObjectByType("Worksheet", self.context, tmpID())
            ws.processForm()
            ws.setAnalyst(analyst)
            if instrument_uid:
                ws.setInstrument(instrument_uid)
            ws.setResultsLayout(api.get_bika_setup().getWorksheetLayout())
            # event subscribers read context_uid off the request
            self.request["context_uid"] = api.get_uid(ws)
            if template_uid:
                wst = _obj_or_none(template_uid)
                if wst is None:
                    self.request.response.setStatus(400)
                    return json.dumps({"success": False, "error": "Worksheet template not found"})
                ws.applyWorksheetTemplate(wst)
            ws.reindexObject()
        except Exception as e:
            self.request.response.setStatus(400)
            return json.dumps({"success": False, "error": str(e)})

        return json.dumps(_serialize(ws))


class ApplyWorksheetTemplateView(BrowserView):
    """POST {template} to <worksheet-object-url>/@@apply-worksheet-template —
    applies a Worksheet Template to an existing (typically empty) worksheet."""

    def __call__(self):
        self.request.response.setHeader("Content-Type", "application/json")
        payload = _read_body(self.request)
        if payload is None:
            self.request.response.setStatus(400)
            return json.dumps({"success": False, "error": "Invalid JSON body"})

        wst = _obj_or_none(payload.get("template") or "")
        if wst is None:
            self.request.response.setStatus(400)
            return json.dumps({"success": False, "error": "Worksheet template not found"})

        try:
            self.context.applyWorksheetTemplate(wst)
            self.context.reindexObject()
        except Exception as e:
            self.request.response.setStatus(400)
            return json.dumps({"success": False, "error": str(e)})

        return json.dumps(_serialize(self.context))


class WorksheetInfoView(BrowserView):
    """GET <worksheet-object-url>/@@worksheet-info — full JSON serialize
    (analyst, instrument, template, slot layout + per-slot analysis, QC counts,
    review_state) for the frontend list/detail."""

    def __call__(self):
        self.request.response.setHeader("Content-Type", "application/json")
        return json.dumps(_serialize(self.context))


class AddAnalysesView(BrowserView):
    """POST {analyses: [uid, ...]} to <worksheet>/@@add-worksheet-analyses —
    add unassigned routine analyses to the worksheet. Calls the worksheet's own
    addAnalyses(), which runs the `assign` transition, cascades instrument/
    method/analyst, and lays each out in a slot."""

    def __call__(self):
        self.request.response.setHeader("Content-Type", "application/json")
        payload = _read_body(self.request)
        if payload is None:
            self.request.response.setStatus(400)
            return json.dumps({"success": False, "error": "Invalid JSON body"})
        uids = payload.get("analyses") or []
        objs = [o for o in (_obj_or_none(u) for u in uids) if o is not None]
        try:
            self.context.addAnalyses(objs)
            self.context.reindexObject()
        except Exception as e:
            self.request.response.setStatus(400)
            return json.dumps({"success": False, "error": str(e)})
        return json.dumps(_serialize(self.context))


class RemoveAnalysesView(BrowserView):
    """POST {analyses: [uid, ...]} to <worksheet>/@@remove-worksheet-analyses —
    unassign the given analyses from the worksheet (delegates to the analysis
    `unassign` transition)."""

    def __call__(self):
        self.request.response.setHeader("Content-Type", "application/json")
        payload = _read_body(self.request)
        if payload is None:
            self.request.response.setStatus(400)
            return json.dumps({"success": False, "error": "Invalid JSON body"})
        uids = payload.get("analyses") or []
        try:
            for u in uids:
                obj = _obj_or_none(u)
                if obj is not None:
                    self.context.removeAnalysis(obj)
            self.context.reindexObject()
        except Exception as e:
            self.request.response.setStatus(400)
            return json.dumps({"success": False, "error": str(e)})
        return json.dumps(_serialize(self.context))


class AddDuplicateView(BrowserView):
    """POST {src_slot: <int>, dest_slot?: <int>} to
    <worksheet>/@@add-worksheet-duplicate — create duplicate QC analyses of the
    routine analyses in src_slot."""

    def __call__(self):
        self.request.response.setHeader("Content-Type", "application/json")
        payload = _read_body(self.request)
        if payload is None:
            self.request.response.setStatus(400)
            return json.dumps({"success": False, "error": "Invalid JSON body"})
        src_slot = payload.get("src_slot")
        dest_slot = payload.get("dest_slot")
        try:
            added = self.context.addDuplicateAnalyses(src_slot, dest_slot)
            self.context.reindexObject()
        except Exception as e:
            self.request.response.setStatus(400)
            return json.dumps({"success": False, "error": str(e)})
        result = _serialize(self.context)
        result["added"] = len(added or [])
        return json.dumps(result)


class AddReferenceView(BrowserView):
    """POST {reference: <ReferenceSample uid>, services: [uid, ...], slot?} to
    <worksheet>/@@add-worksheet-reference — add Blank/Control QC analyses from a
    reference sample (the sample's own getBlank() decides blank vs control)."""

    def __call__(self):
        self.request.response.setHeader("Content-Type", "application/json")
        payload = _read_body(self.request)
        if payload is None:
            self.request.response.setStatus(400)
            return json.dumps({"success": False, "error": "Invalid JSON body"})
        reference = _obj_or_none(payload.get("reference") or "")
        if reference is None:
            self.request.response.setStatus(400)
            return json.dumps({"success": False, "error": "Reference sample not found"})
        services = payload.get("services") or []
        slot = payload.get("slot")
        try:
            added = self.context.addReferenceAnalyses(reference, services, slot)
            self.context.reindexObject()
        except Exception as e:
            self.request.response.setStatus(400)
            return json.dumps({"success": False, "error": str(e)})
        result = _serialize(self.context)
        result["added"] = len(added or [])
        return json.dumps(result)


class UpdateWorksheetView(BrowserView):
    """POST {analyst?, instrument?, method?, remarks?} to
    <worksheet>/@@update-worksheet — reassign analyst / instrument / method and
    set remarks on an existing worksheet. instrument/method cascade to the
    worksheet's analyses (override_analyses=True)."""

    def __call__(self):
        self.request.response.setHeader("Content-Type", "application/json")
        payload = _read_body(self.request)
        if payload is None:
            self.request.response.setStatus(400)
            return json.dumps({"success": False, "error": "Invalid JSON body"})
        ws = self.context
        try:
            if "analyst" in payload:
                ws.setAnalyst(payload.get("analyst") or "")
            if "instrument" in payload:
                val = payload.get("instrument") or ""
                if val:
                    ws.setInstrument(val, True)
                else:
                    # Clear: setInstrument("") crashes in api.get_object("")
                    # before it reaches its own clear step, so set the field to
                    # None directly (exactly what setInstrument does when the
                    # resolved instrument is None) to support un-assigning.
                    ws.getField("Instrument").set(ws, None)
            if "method" in payload:
                val = payload.get("method") or ""
                if val:
                    ws.setMethod(val, True)
                else:
                    ws.getField("Method").set(ws, None)
            if "remarks" in payload:
                ws.setRemarks(payload.get("remarks") or "")
            ws.reindexObject()
        except Exception as e:
            self.request.response.setStatus(400)
            return json.dumps({"success": False, "error": str(e)})
        return json.dumps(_serialize(ws))


class LabAnalystsView(BrowserView):
    """GET <worksheets-folder-url>/@@lab-analysts — return the lab members who
    may be assigned as a worksheet analyst, as [{id, fullname}]. Sourced from
    Plone members holding a lab role (Analyst / LabManager / LabClerk /
    Manager) via SENAITE's own api.get_users_by_roles, so the picker matches
    exactly who SENAITE itself treats as eligible analysts. `id` is the member
    id that setAnalyst expects; `fullname` falls back to the id when unset."""

    ROLES = ["Analyst", "LabManager", "LabClerk", "Manager"]

    def __call__(self):
        self.request.response.setHeader("Content-Type", "application/json")
        seen = {}
        try:
            for member in api.get_users_by_roles(self.ROLES):
                mid = member.getId()
                if not mid or mid in seen:
                    continue
                fullname = ""
                try:
                    fullname = member.getProperty("fullname", "") or ""
                except Exception:
                    fullname = ""
                seen[mid] = {"id": mid, "fullname": fullname or mid}
        except Exception as e:
            self.request.response.setStatus(400)
            return json.dumps({"success": False, "error": str(e)})
        analysts = sorted(seen.values(), key=lambda a: a["fullname"].lower())
        return json.dumps({"success": True, "analysts": analysts})
