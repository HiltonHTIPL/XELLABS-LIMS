# -*- coding: utf-8 -*-
"""
Custom views for creating/updating a Client's Address fields (and the rest of
its schema) via JSON, bypassing the broken "inline_field_validator" attached
to the country/state/district sub-fields of PhysicalAddress/PostalAddress/
BillingAddress (declared on the shared Organisation base class Client
inherits from — see bika/lims/content/organisation.py).

That validator (bika/lims/validators.py InlineFieldValidator.__call__) does:

    request = kwargs['REQUEST']
    data = request.get(field.getName())

bika.lims.api.validate()/obj.validate(data=True) — the call every REST path
(senaite.jsonapi's v1 create/update AND plone.restapi's own PATCH deserializer)
uses to validate an Archetypes object — never passes a REQUEST kwarg down
(Products.Archetypes.BaseObject.validate() defaults REQUEST=None), so `request`
is always None here. Confirmed by direct testing against a live instance: any
save with a non-blank Country/State/District value on any of the 3 address
blocks crashes with "'NoneType' object has no attribute 'get'" via every
official REST path, both legacy jsonapi and modern restapi. Street/City/Zip
have no validator attached and are unaffected.

bika.lims.api.create()/api.edit() set AT fields via their mutators
(field.getMutator()) rather than field.validate(), so they never invoke the
registered validators at all — same bypass pattern already used for
Calculation.Formula (see calculation_views.py).
"""
import json

from bika.lims import api
from Products.Five.browser import BrowserView


def _serialize(obj):
    return {
        "success": True,
        "uid": obj.UID(),
        "id": obj.getId(),
        "path": "/".join(obj.getPhysicalPath()),
        "title": obj.Title(),
        "ClientID": obj.getClientID(),
        "PhysicalAddress": obj.getPhysicalAddress() or {},
        "PostalAddress": obj.getPostalAddress() or {},
        "BillingAddress": obj.getBillingAddress() or {},
    }


def _read_body(request):
    try:
        return json.loads(request.get("BODY", "{}") or "{}")
    except ValueError:
        return None


# Only fields this endpoint is meant to manage — everything else (Contact,
# workflow, etc.) is handled by its own existing endpoint/flow.
ALLOWED_FIELDS = (
    "title", "ClientID", "EmailAddress", "Phone", "Fax", "TaxNumber",
    "AccountName", "AccountNumber", "AccountType", "BankName", "BankBranch",
    "CCEmails", "BulkDiscount", "MemberDiscountApplies", "DecimalMark",
    "description", "PhysicalAddress", "PostalAddress", "BillingAddress",
)


def _clean_kwargs(payload):
    return {k: payload[k] for k in ALLOWED_FIELDS if k in payload}


class CreateClientView(BrowserView):
    """POST a Client payload (see ALLOWED_FIELDS) to
    <clients-folder-url>/@@create-client-safe"""

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

        try:
            obj = api.create(self.context, "Client", title=title, **kwargs)
        except Exception as e:
            self.request.response.setStatus(400)
            return json.dumps({"success": False, "error": str(e)})

        return json.dumps(_serialize(obj))


class UpdateClientView(BrowserView):
    """POST a partial Client payload (see ALLOWED_FIELDS) to
    <client-object-url>/@@update-client-safe"""

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
            obj.reindexObject()
        except Exception as e:
            self.request.response.setStatus(400)
            return json.dumps({"success": False, "error": str(e)})

        return json.dumps(_serialize(obj))
