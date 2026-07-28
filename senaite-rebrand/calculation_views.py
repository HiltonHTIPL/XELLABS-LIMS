# -*- coding: utf-8 -*-
"""
Custom views for creating/updating Calculation objects via JSON, bypassing
SENAITE's Formula field validator ("formulavalidator" in bika/lims/validators.py).

That validator reads request.form.get("InterimFields", []) — raw classic Zope
form-POST data — to decide whether a bracketed keyword in the Formula refers to
a valid interim field. plone.restapi's JSON body parsing never populates
request.form, so ANY formula referencing an interim (non-analysis-service)
keyword is rejected by every REST path (create, PATCH, any field ordering) —
confirmed by direct testing against a live instance, not assumed from docs.

bika.lims.api.edit() sets AT fields via their mutators (field.getMutator())
rather than field.validate(), so it never invokes the registered validators at
all — Calculation.setFormula() itself is already safe to call directly: it only
extracts [keyword] tokens via regex and resolves the ones that match a real
AnalysisService keyword into DependentServices, silently ignoring anything
else (including interim keywords, which is exactly what's wanted).
"""
import json

from bika.lims import api
from Products.Five.browser import BrowserView


def _serialize(obj):
    dependent = []
    for svc in obj.getDependentServices():
        dependent.append({
            "uid": svc.UID(),
            "title": svc.Title(),
            "keyword": svc.getKeyword(),
        })
    return {
        "success": True,
        "uid": obj.UID(),
        "id": obj.getId(),
        "title": obj.Title(),
        "description": obj.Description(),
        "formula": obj.getFormula() or "",
        "interim_fields": obj.getInterimFields() or [],
        "python_imports": obj.getPythonImports() or [],
        "dependent_services": dependent,
        "test_parameters": obj.getTestParameters() or [],
        "test_result": obj.getTestResult() or "",
        "is_active": api.is_active(obj),
    }


def _refresh_test_parameters(obj, submitted_values=None):
    """Rebuild TestParameters from the object's current InterimFields +
    DependentServices (mirrors what SENAITE's own objectmodified subscriber
    does after every classic-UI save — never fires for our direct mutator
    calls, so it's replicated explicitly here), optionally seeding values
    from a caller-submitted {keyword: value} map."""
    submitted_values = submitted_values or {}
    params = []
    for interim in obj.getInterimFields():
        keyword = interim.get("keyword")
        value = submitted_values.get(keyword, interim.get("value"))
        params.append({"keyword": keyword, "value": value})
    for service in obj.getDependentServices():
        keyword = service.getKeyword()
        value = submitted_values.get(keyword, "")
        params.append({"keyword": keyword, "value": value})
    obj.setTestParameters(params)


def _read_body(request):
    try:
        return json.loads(request.get("BODY", "{}") or "{}")
    except ValueError:
        return None


def _clean_kwargs(payload):
    """Only pass through fields explicitly present in the request body, and
    only the ones this endpoint is meant to manage."""
    allowed = ("title", "description", "InterimFields", "Formula", "PythonImports")
    key_map = {
        "title": "title", "description": "description",
        "interim_fields": "InterimFields", "formula": "Formula",
        "python_imports": "PythonImports",
    }
    kwargs = {}
    for incoming_key, at_key in key_map.items():
        if incoming_key in payload and at_key in allowed:
            kwargs[at_key] = payload[incoming_key]
    return kwargs


class CreateCalculationView(BrowserView):
    """POST {title, description?, formula, interim_fields?, python_imports?}
    to <bika_calculations-folder-url>/@@create-calculation"""

    def __call__(self):
        self.request.response.setHeader("Content-Type", "application/json")
        payload = _read_body(self.request)
        if payload is None:
            self.request.response.setStatus(400)
            return json.dumps({"success": False, "error": "Invalid JSON body"})

        kwargs = _clean_kwargs(payload)
        title = kwargs.pop("title", "") or payload.get("title", "")
        if not title:
            self.request.response.setStatus(400)
            return json.dumps({"success": False, "error": "title is required"})
        if not kwargs.get("Formula"):
            self.request.response.setStatus(400)
            return json.dumps({"success": False, "error": "formula is required"})

        try:
            obj = api.create(self.context, "Calculation", title=title, **kwargs)
            _refresh_test_parameters(obj)
        except Exception as e:
            self.request.response.setStatus(400)
            return json.dumps({"success": False, "error": str(e)})

        return json.dumps(_serialize(obj))


class UpdateCalculationView(BrowserView):
    """POST {title?, description?, formula?, interim_fields?, python_imports?}
    to <calculation-object-url>/@@update-calculation"""

    def __call__(self):
        self.request.response.setHeader("Content-Type", "application/json")
        payload = _read_body(self.request)
        if payload is None:
            self.request.response.setStatus(400)
            return json.dumps({"success": False, "error": "Invalid JSON body"})

        kwargs = _clean_kwargs(payload)
        obj = self.context
        try:
            if kwargs:
                api.edit(obj, check_permissions=False, **kwargs)
            if "InterimFields" in kwargs or "Formula" in kwargs:
                # Keep TestParameters keyword list in sync with the current
                # formula's dependencies, preserving values for keywords that
                # still exist.
                existing = {p.get("keyword"): p.get("value") for p in (obj.getTestParameters() or [])}
                _refresh_test_parameters(obj, existing)
            obj.reindexObject()
        except Exception as e:
            self.request.response.setStatus(400)
            return json.dumps({"success": False, "error": str(e)})

        return json.dumps(_serialize(obj))


class TestCalculationView(BrowserView):
    """POST {test_parameters: [{keyword, value}]} to
    <calculation-object-url>/@@test-calculation — sets the given values into
    TestParameters and computes TestResult, replicating what SENAITE's own
    objectmodified subscriber does after a classic-UI save (that subscriber
    never fires for our direct api.edit() calls, so it's done explicitly)."""

    def __call__(self):
        self.request.response.setHeader("Content-Type", "application/json")
        payload = _read_body(self.request)
        if payload is None:
            self.request.response.setStatus(400)
            return json.dumps({"success": False, "error": "Invalid JSON body"})

        obj = self.context
        try:
            submitted = {
                row.get("keyword"): row.get("value")
                for row in (payload.get("test_parameters") or [])
            }
            _refresh_test_parameters(obj, submitted)
            obj.setTestResult(None)
        except Exception as e:
            self.request.response.setStatus(400)
            return json.dumps({"success": False, "error": str(e)})

        return json.dumps(_serialize(obj))
