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
