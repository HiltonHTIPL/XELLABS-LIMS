"""Shared test fixtures for tenant-scoped API tests.

Multi-tenant apps (lims, inventory, instruments, workflow, audittrail,
reporting) only resolve requests when django-tenants can map the request's
Host header to a Tenant. Plain APITestCase leaves the test client's default
Host (``testserver``) unmapped, so every tenant-scoped endpoint 404s (or
errors on missing tables, since TENANT_APPS aren't migrated onto the public
schema) before it even reaches a view.

TenantAPITestCase creates a throwaway tenant + schema per test class, with
its domain set to ``testserver`` so the default DRF test client resolves to
it automatically — no header juggling needed in individual tests.
"""
from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APITestCase


class TenantAPITestCase(TenantTestCase, APITestCase):
    @classmethod
    def get_test_tenant_domain(cls):
        return "testserver"
