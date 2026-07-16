# -*- coding: utf-8 -*-
#
# Custom plone.restapi field deserializer for SampleType.admitted_sticker_templates.
#
# senaite.core's admitted_sticker_templates is a DataGridField wrapping a row
# schema (IStickersRecordSchema: admitted=Set(Choice(...)), small_default/
# large_default=Choice(...)). plone.restapi's DefaultFieldDeserializer calls
# self.field.validate(value) for any non-unicode payload, which tries to
# validate a plain JSON list-of-dicts against the nested row schema and fails
# with "Wrong contained type" / "Object is of wrong type" — no deserializer
# for this field type is registered anywhere in this SENAITE build (confirmed:
# no restapi deserializer exists in senaite.core or any installed egg).
#
# Fix: bypass schema validation entirely and write straight through the
# content object's own existing mutator (setAdmittedStickerTemplates, already
# defined in senaite/core/content/sampletype.py) — the same method the
# classic @@API/senaite/v1 create/update endpoints would use if they had a
# working adapter for this field, and the same one the browser edit form
# uses under the hood via z3c.form's data manager.

from plone.restapi.deserializer.dxfields import DefaultFieldDeserializer
from plone.restapi.interfaces import IFieldDeserializer
from senaite.core.interfaces import ISampleType
from senaite.core.schema.fields import DataGridField
from zope.component import adapter
from zope.interface import implementer
from zope.publisher.interfaces.browser import IBrowserRequest


@implementer(IFieldDeserializer)
@adapter(DataGridField, ISampleType, IBrowserRequest)
class SampleTypeStickerTemplatesFieldDeserializer(DefaultFieldDeserializer):
    """Deserializer for SampleType.admitted_sticker_templates.

    Accepts the same JSON shape the GET representation returns:
        [{"admitted": [<sticker id>, ...],
          "small_default": <sticker id> | None,
          "large_default": <sticker id> | None}]
    """

    def __call__(self, value):
        rows = []
        for row in (value or []):
            if not isinstance(row, dict):
                continue
            rows.append({
                "admitted": set(row.get("admitted") or []),
                "small_default": row.get("small_default") or None,
                "large_default": row.get("large_default") or None,
            })
        self.context.setAdmittedStickerTemplates(rows or None)
        return self.context.getAdmittedStickerTemplates()
