# -*- coding: utf-8 -*-
"""
Custom JSON views for creating/updating LabContact objects and updating the
Laboratory singleton, bypassing the broken "inline_field_validator" attached to
the country/state/district sub-fields of the Address fields both types inherit
(LabContact from Person, Laboratory from Organisation) — exactly the same root
cause and bypass mechanism documented in client_address_views.py.

That validator (bika/lims/validators.py InlineFieldValidator.__call__) reads
kwargs['REQUEST'], which obj.validate(data=True) never supplies, so any non-blank
Country/State/District crashes every REST path with
"'NoneType' object has no attribute 'get'". bika.lims.api.create()/api.edit()
set AT fields via their mutators (never field.validate()), so the validators are
never invoked.

Image fields (LabContact.Signature, Laboratory.AccreditationBodyLogo) accept a
base64-encoded value (optionally a "data:...;base64,<data>" data-URI) which we
decode to raw bytes before handing to the field mutator, since JSON cannot carry
binary directly.
"""
import base64
import json

from bika.lims import api
from Products.Five.browser import BrowserView


def _read_body(request):
    try:
        return json.loads(request.get("BODY", "{}") or "{}")
    except ValueError:
        return None


def _decode_image(value):
    """Accept a base64 string or data-URI; return raw bytes (or None to skip)."""
    if not value:
        return None
    if isinstance(value, dict):
        value = value.get("data") or value.get("value") or ""
    if not isinstance(value, basestring):  # noqa: F821 (py2)
        return None
    if "," in value and value.strip().startswith("data:"):
        value = value.split(",", 1)[1]
    try:
        return base64.b64decode(value)
    except Exception:
        return None


# ----------------------------------------------------------------------------
# LabContact
# ----------------------------------------------------------------------------
LABCONTACT_FIELDS = (
    "Salutation", "Firstname", "Middleinitial", "Middlename", "Surname",
    "EmailAddress", "BusinessPhone", "BusinessFax", "HomePhone", "MobilePhone",
    "JobTitle", "Department", "Departments", "DefaultDepartment",
    "PhysicalAddress", "PostalAddress",
)
LABCONTACT_IMAGE_FIELDS = ("Signature",)


def _serialize_labcontact(obj):
    return {
        "success": True,
        "uid": obj.UID(),
        "id": obj.getId(),
        "path": "/".join(obj.getPhysicalPath()),
        "title": obj.Title(),
        "Firstname": obj.getFirstname(),
        "Surname": obj.getSurname(),
        "EmailAddress": obj.getEmailAddress(),
    }


def _split_image_kwargs(payload, allowed, image_fields):
    kwargs = {k: payload[k] for k in allowed if k in payload}
    images = {}
    for f in image_fields:
        if f in payload:
            raw = _decode_image(payload[f])
            if raw:
                images[f] = raw
    return kwargs, images


def _apply_images(obj, images):
    for name, raw in images.items():
        field = obj.getField(name)
        if field is not None:
            field.set(obj, raw)


class CreateLabContactView(BrowserView):
    """POST to <bika_labcontacts-url>/@@create-labcontact-safe"""

    def __call__(self):
        self.request.response.setHeader("Content-Type", "application/json")
        payload = _read_body(self.request)
        if payload is None:
            self.request.response.setStatus(400)
            return json.dumps({"success": False, "error": "Invalid JSON body"})

        kwargs, images = _split_image_kwargs(
            payload, LABCONTACT_FIELDS, LABCONTACT_IMAGE_FIELDS)
        firstname = kwargs.get("Firstname", "")
        surname = kwargs.get("Surname", "")
        if not firstname or not surname:
            self.request.response.setStatus(400)
            return json.dumps({"success": False,
                               "error": "Firstname and Surname are required"})
        try:
            obj = api.create(self.context, "LabContact", **kwargs)
            if images:
                _apply_images(obj, images)
            obj.reindexObject()
        except Exception as e:
            self.request.response.setStatus(400)
            return json.dumps({"success": False, "error": str(e)})

        return json.dumps(_serialize_labcontact(obj))


class UpdateLabContactView(BrowserView):
    """POST to <labcontact-object-url>/@@update-labcontact-safe"""

    def __call__(self):
        self.request.response.setHeader("Content-Type", "application/json")
        payload = _read_body(self.request)
        if payload is None:
            self.request.response.setStatus(400)
            return json.dumps({"success": False, "error": "Invalid JSON body"})

        kwargs, images = _split_image_kwargs(
            payload, LABCONTACT_FIELDS, LABCONTACT_IMAGE_FIELDS)
        obj = self.context
        try:
            if kwargs:
                api.edit(obj, check_permissions=False, **kwargs)
            if images:
                _apply_images(obj, images)
            obj.reindexObject()
        except Exception as e:
            self.request.response.setStatus(400)
            return json.dumps({"success": False, "error": str(e)})

        return json.dumps(_serialize_labcontact(obj))


# ----------------------------------------------------------------------------
# Laboratory (singleton — edit only)
# ----------------------------------------------------------------------------
LABORATORY_FIELDS = (
    "title", "Name", "TaxNumber", "Phone", "Fax", "EmailAddress", "AccountType",
    "AccountName", "AccountNumber", "BankName", "BankBranch",
    "LabURL", "Supervisor", "Confidence", "LaboratoryAccredited",
    "AccreditationBody", "AccreditationBodyURL", "Accreditation",
    "AccreditationReference", "AccreditationPageHeader",
    "PhysicalAddress", "PostalAddress", "BillingAddress",
)
LABORATORY_IMAGE_FIELDS = ("AccreditationBodyLogo",)


def _serialize_laboratory(obj):
    return {
        "success": True,
        "uid": obj.UID(),
        "id": obj.getId(),
        "path": "/".join(obj.getPhysicalPath()),
        "title": obj.Title(),
    }


class UpdateLaboratoryView(BrowserView):
    """POST to <laboratory-object-url>/@@update-laboratory-safe"""

    def __call__(self):
        self.request.response.setHeader("Content-Type", "application/json")
        payload = _read_body(self.request)
        if payload is None:
            self.request.response.setStatus(400)
            return json.dumps({"success": False, "error": "Invalid JSON body"})

        kwargs, images = _split_image_kwargs(
            payload, LABORATORY_FIELDS, LABORATORY_IMAGE_FIELDS)
        # "Name" maps to the title field on the Organisation base.
        if "Name" in kwargs and "title" not in kwargs:
            kwargs["title"] = kwargs.pop("Name")
        else:
            kwargs.pop("Name", None)
        obj = self.context
        try:
            if kwargs:
                api.edit(obj, check_permissions=False, **kwargs)
            if images:
                _apply_images(obj, images)
            obj.reindexObject()
        except Exception as e:
            self.request.response.setStatus(400)
            return json.dumps({"success": False, "error": str(e)})

        return json.dumps(_serialize_laboratory(obj))
