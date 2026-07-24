# -*- coding: utf-8 -*-
"""
Custom view to make SENAITE's real Analysis.calculateResult() engine run
against a live Analysis object over REST — needed for any Analysis Service
whose Calculation depends on Interim Fields (e.g. "Soil Calcium and
Magnesium": [CA]+[MG]).

Root cause (confirmed by reading bika/lims/content/abstractanalysis.py
directly, not guessed): calculateResult() is a genuine method already present
on every Analysis. It merges the linked Calculation's own InterimFields with
the Analysis's own InterimFields (Analysis values win), evaluates the
formula, and finishes with self.setResult(str(result)) — this is exactly
SENAITE's real calculation engine, not a reimplementation.

In SENAITE's own classic widget this fires via a JS-driven AJAX call the
moment an interim cell's value changes. A flat REST POST/PATCH of
{Result, InterimFields} never replays that change-event, so it just stores
whatever was sent — no recompute. This view is the REST-callable equivalent
of that trigger: write the submitted interim values onto the Analysis's own
InterimFields, then call calculateResult(override=True) (override is needed
because the method silently no-ops if Result is already non-empty) so it
recomputes unconditionally, and return the freshly computed Result.
"""
import json

from Products.Five.browser import BrowserView


class CalculateAnalysisResultView(BrowserView):
    """POST {interim_fields: [{keyword, value}, ...]} to
    <analysis-object-url>/@@calculate-analysis-result

    Only `keyword`/`value` need be present per submitted row — every other
    subfield (title/unit/choices/etc.) is preserved from the Analysis's
    existing InterimFields definition, which the Analysis Service already
    seeded when the Analysis was created."""

    def __call__(self):
        self.request.response.setHeader("Content-Type", "application/json")
        try:
            payload = json.loads(self.request.get("BODY", "{}") or "{}")
        except ValueError:
            self.request.response.setStatus(400)
            return json.dumps({"success": False, "error": "Invalid JSON body"})

        submitted = payload.get("interim_fields") or []
        submitted_by_kw = {
            row.get("keyword"): row for row in submitted if row.get("keyword")
        }

        analysis = self.context
        existing = analysis.getInterimFields() or []
        merged = []
        seen = set()
        for row in existing:
            kw = row.get("keyword")
            merged_row = dict(row)
            if kw in submitted_by_kw:
                merged_row["value"] = submitted_by_kw[kw].get("value", "")
            merged.append(merged_row)
            seen.add(kw)
        # A submitted keyword the Analysis doesn't already define shouldn't
        # happen in practice (the Service defines the full interim set), but
        # append rather than silently drop it if it ever does.
        for kw, row in submitted_by_kw.items():
            if kw not in seen:
                merged.append({"keyword": kw, "value": row.get("value", "")})

        try:
            analysis.setInterimFields(merged)
            analysis.calculateResult(override=True)
            analysis.reindexObject()
        except Exception as e:
            self.request.response.setStatus(400)
            return json.dumps({"success": False, "error": str(e)})

        return json.dumps({
            "success": True,
            "result": analysis.getResult() or "",
            "interim_fields": analysis.getInterimFields() or [],
        })


class SetSelfVerificationView(BrowserView):
    """POST {} to <analysis-object-url>/@@set-self-verification

    SelfVerification (and the other detection/quantification-limit fields
    alongside it - see the LOD/ALQ backfill note in CLAUDE.md) is snapshotted
    onto each Analysis from its Service at CREATE time, not read through live -
    confirmed live: updating the Service's own SelfVerification afterward has
    no effect on already-created Analysis objects, and the generic REST
    v1/update path rejects writing this specific field directly ("Not allowed
    to set the field 'SelfVerification'"). This view bypasses that guard by
    calling the object's own mutator directly, the same bypass pattern as
    every other custom view in this codebase. Sets it to 1 (always allow
    self-verification for this specific analysis), matching the lab-wide
    bika_setup.SelfVerificationEnabled toggle's intent for analyses created
    before that Service-level default existed."""

    def __call__(self):
        self.request.response.setHeader("Content-Type", "application/json")
        try:
            self.context.setSelfVerification(1)
            self.context.reindexObject()
        except Exception as e:
            self.request.response.setStatus(400)
            return json.dumps({"success": False, "error": str(e)})
        # Diagnostic fields for the other guard_verify() conditions (see
        # bika/lims/workflow/analysis/guards.py) - lets us confirm which
        # specific condition is blocking verify without guessing.
        submitted_by = ""
        try:
            submitted_by = self.context.getSubmittedBy() or ""
        except Exception:
            pass
        remaining = None
        try:
            remaining = self.context.getNumberOfRemainingVerifications()
        except Exception:
            pass
        required = None
        try:
            required = self.context.getNumberOfRequiredVerifications()
        except Exception:
            pass
        deps = []
        try:
            deps = [d.getId() for d in self.context.getDependencies()]
        except Exception:
            pass
        return json.dumps({
            "success": True,
            "self_verification": self.context.getSelfVerification(),
            "submitted_by": submitted_by,
            "remaining_verifications": remaining,
            "required_verifications": required,
            "dependencies": deps,
        })
