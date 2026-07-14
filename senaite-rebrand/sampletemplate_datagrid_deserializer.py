# -*- coding: utf-8 -*-
#
# Custom plone.restapi field deserializer for SampleTemplate.partitions and
# SampleTemplate.services.
#
# Both fields are declared as zope.schema.List(value_type=DataGridRow(...))
# on senaite.core.content.sampletemplate.ISampleTemplateSchema. plone.restapi's
# DefaultFieldDeserializer validates a plain JSON list-of-dicts against the
# DataGridRow's nested schema and fails with "Wrong contained type" — same
# root cause already fixed for SampleType.admitted_sticker_templates (see
# sampletype_stickers_deserializer.py): no restapi deserializer is registered
# anywhere in this SENAITE build for List(value_type=DataGridRow(...)) fields.
#
# Fix: bypass schema validation AND the object's own setPartitions()/
# setServices() convenience methods — live testing showed setPartitions()
# itself is buggy when called with plain scalar UIDs (the normal case for a
# multi_valued=False UIDReferenceField): it stores container/preservation/
# sampletype as a bare string, but getPartitions() unconditionally does
# `items[0]` on those sub-values ("UIDReference sub-fields are stored as a
# list!" — see senaite.core PR #2630), truncating a UID like
# "c0bd376d29f24baf845254b11ada9ebb" down to just "c". So we write straight
# to the field's own storage instead, pre-shaping every UIDReference
# sub-field as a single-element list to match what getPartitions() expects
# to unwrap. services has no such sub-fields (uid/hidden/part_id are plain
# scalars) so it's written as-is.

from plone.restapi.deserializer.dxfields import DefaultFieldDeserializer
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
class SampleTemplateDataGridFieldDeserializer(DefaultFieldDeserializer):
    """Deserializer for SampleTemplate.partitions and SampleTemplate.services."""

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

        # Not a field we special-case — fall back to default behavior.
        return super(SampleTemplateDataGridFieldDeserializer, self).__call__(value)
