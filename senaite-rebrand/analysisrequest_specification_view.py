# -*- coding: utf-8 -*-
"""
Custom view to push a per-Analysis-Service ResultsRange (min/max/warn_min/
warn_max) directly onto a live AnalysisRequest and cascade it to its
analyses - the real mechanism SENAITE's own AnalysisRequest.setResultsRange()
uses for this (confirmed by reading bika/lims/content/analysisrequest.py
directly, not guessed): it iterates every not-yet-submitted child Analysis
and calls analysis.setResultsRange(range) for the matching service uid, which
is exactly what bika.lims.api.analysis.is_out_of_range() and the Results
admin page's ResultsRange read back afterward.

Our Django-side "AnalysisSpecification" has no SENAITE-native AnalysisSpec
counterpart - rather than syncing a whole separate content type, this view
lets the frontend push the already-resolved ranges straight through over
REST, reusing SENAITE's own setResultsRange() so isOutOfRange() works exactly
as it would for a native Specification-linked sample.
"""
import json

from Products.Five.browser import BrowserView


class SetResultsRangeView(BrowserView):
    """POST {results_ranges: [{uid, min, max, warn_min, warn_max}, ...]} to
    <analysisrequest-url>/@@set-results-range"""

    def __call__(self):
        self.request.response.setHeader("Content-Type", "application/json")
        try:
            payload = json.loads(self.request.get("BODY", "{}") or "{}")
        except ValueError:
            self.request.response.setStatus(400)
            return json.dumps({"success": False, "error": "Invalid JSON body"})

        ranges = payload.get("results_ranges") or []
        clean = []
        for r in ranges:
            uid = r.get("uid")
            if not uid:
                continue
            clean.append({
                "uid": uid,
                "keyword": r.get("keyword", ""),
                "min": r.get("min", ""),
                "max": r.get("max", ""),
                "warn_min": r.get("warn_min", ""),
                "warn_max": r.get("warn_max", ""),
            })

        ar = self.context
        try:
            ar.setResultsRange(clean, recursive=False)
        except Exception as e:
            self.request.response.setStatus(400)
            return json.dumps({"success": False, "error": str(e)})

        return json.dumps({
            "success": True,
            "results_range": ar.getResultsRange() or [],
        })
