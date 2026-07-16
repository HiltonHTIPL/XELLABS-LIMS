# -*- coding: utf-8 -*-
#
# Custom plone.restapi field deserializer for SampleTemplate.partitions and
# SampleTemplate.services.
#
# Both fields are declared as zope.schema.List(value_type=DataGridRow(...))
# on senaite.core.content.sampletemplate.ISampleTemplateSchema. plone.restapi's
# CollectionFieldDeserializer (registered for ICollection) fails to validate a
# plain JSON list-of-dicts against the DataGridRow's nested schema, raising
# "Wrong contained type" — same root cause already fixed for SampleType.
# admitted_sticker_templates (see sampletype_stickers_deserializer.py): no
# restapi deserializer correctly handles List(value_type=DataGridRow(...)).
#
# IMPORTANT: this adapter is registered on the bare `List` class (not just
# DataGridRow-typed lists), so it ALSO matches every other List-typed field on
# SampleTemplate — most importantly `sampletype`/`samplepoint`, which are
# senaite.core.schema.UIDReferenceField(List, BaseField) instances. Confirmed
# live (2026-07-14) via a real A/B test: subclassing plone.restapi's plain
# DefaultFieldDeserializer and falling through via `super().__call__()` for
# non-partitions/services fields broke `sampletype`/`samplepoint`
# deserialization outright ("Wrong contained type"), even with a ZERO-logic
# passthrough subclass — because it shadowed plone.restapi's more-specific
# CollectionFieldDeserializer (registered on ICollection), which does REQUIRED
# per-item value_type deserialization + `self.field._type(value)` coercion
# before validating. DefaultFieldDeserializer skips both steps, so a plain
# list of UID strings fails `self.field.validate()`.
#
# Fix: subclass CollectionFieldDeserializer (not DefaultFieldDeserializer) so
# the fallback branch delegates to the SAME logic plone.restapi would have used
# had this adapter not been registered at all — only partitions/services get
# custom handling; everything else (sampletype, samplepoint) round-trips
# through the real, correct, unshadowed behavior. Verified live: title,
# sampletype, partitions, and services all persist correctly together in a
# single create POST after this fix.
#
# For partitions/services themselves: bypass schema validation entirely and
# write straight to the field's own storage (self.field.set), pre-shaping every
# UIDReference sub-field as a single-element list to match what
# SampleTemplate.getPartitions() expects to unwrap ("UIDReference sub-fields
# are stored as a list!" — see senaite.core PR #2630). services has no such
# sub-fields (uid/hidden/part_id are plain scalars) so it's written as-is.
# Also confirmed live: calling the object's own setPartitions()/setServices()
# convenience methods is itself buggy for scalar UIDs (truncates
# "c0bd376d29f24baf845254b11ada9ebb" down to "c") — writing directly via
# self.field.set() with pre-shaped list values avoids that bug too.

from plone.restapi.deserializer.dxfields import CollectionFieldDeserializer
from plone.restapi.interfaces import IFieldDeserializer
from senaite.core.interfaces import ISampleTemplate
from zope.component import adapter
from zope.interface import implementer
from zope.publisher.interfaces.browser import IBrowserRequest
from zope.schema import List


def _as_uid_list(value):
    if not value:
        return []
    if isinstance(value, (list, tuple)):
        return [v for v in value if v]
    return [value]


@implementer(IFieldDeserializer)
@adapter(List, ISampleTemplate, IBrowserRequest)
class SampleTemplateDataGridFieldDeserializer(CollectionFieldDeserializer):
    """Deserializer for SampleTemplate.partitions and SampleTemplate.services.

    Falls through to CollectionFieldDeserializer (plone.restapi's own correct
    handling) for every other List-typed field on SampleTemplate.
    """

    def __call__(self, value):
        name = self.field.getName()
        rows = [row for row in (value or []) if isinstance(row, dict)]

        if name == "partitions":
            shaped = [{
                "part_id": row.get("part_id") or "part-1",
                "container": _as_uid_list(row.get("container")),
                "preservation": _as_uid_list(row.get("preservation")),
                "sampletype": _as_uid_list(row.get("sampletype")),
            } for row in rows]
            self.field.set(self.context, shaped)
            return self.context.getPartitions()

        if name == "services":
            shaped = [{
                "uid": row.get("uid", ""),
                "hidden": bool(row.get("hidden", False)),
                "part_id": row.get("part_id", ""),
            } for row in rows]
            self.field.set(self.context, shaped)
            return self.context.getRawServices()

        # Not a field we special-case — fall back to plone.restapi's real
        # ICollection handling (not the generic Default one, which would
        # shadow-break sampletype/samplepoint — see module docstring).
        return super(SampleTemplateDataGridFieldDeserializer, self).__call__(value)
