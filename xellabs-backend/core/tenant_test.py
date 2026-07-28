"""
Shared test base for this django-tenants project.

Plain TestCase/APITestCase does NOT work here: tenant-app tables only exist
inside tenant schemas, and the tenant middleware 404s requests whose host
doesn't resolve to a tenant. TenantAPITestCase fixes both:

- TenantTestCase creates a throwaway tenant schema for the class
  (Tenant.save() auto-registers its domains, so the middleware can resolve it).
- The schema name is PER-CLASS (django_tenants' default is a single shared
  'test' schema — one class failing teardown then breaks every later class
  with a duplicate-key error), and any leftover from a crashed previous run
  is dropped before setup.
- self.client is a DRF APIClient that sends X-Tenant-Schema on every request.
- SENAITE-sync signals are disconnected so test saves never enqueue real
  Celery tasks against the production broker.
"""
from django.db import connection
from django.db.models.signals import post_save
from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient


class TenantAPITestCase(TenantTestCase):
    @classmethod
    def get_test_schema_name(cls):
        # Unique per test class; PostgreSQL identifier limit is 63 chars.
        return f"test_{cls.__name__.lower()}"[:60]

    @classmethod
    def get_test_tenant_domain(cls):
        return f"{cls.get_test_schema_name().replace('_', '-')}.test.com"

    @classmethod
    def setup_tenant(cls, tenant):
        schema = cls.get_test_schema_name()
        tenant.name = f"Automated Test Lab {schema}"
        tenant.slug = schema

    @classmethod
    def setUpClass(cls):
        # Clean any leftover tenant/schema from a crashed previous run
        from core.models import Tenant
        schema = cls.get_test_schema_name()
        Tenant.objects.filter(schema_name=schema).delete()
        with connection.cursor() as cur:
            cur.execute(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE')

        super().setUpClass()

        from core.models import Client
        from lims.models import AnalysisRequest
        post_save.disconnect(sender=Client, dispatch_uid="senaite_sync_client")
        post_save.disconnect(sender=AnalysisRequest, dispatch_uid="senaite_sync_ar")

    @classmethod
    def tearDownClass(cls):
        try:
            super().tearDownClass()
        except Exception:
            # Never poison later classes — leftovers are cleaned in setUpClass.
            connection.set_schema_to_public()

    # _pre_setup (not setUp) so subclasses that override setUp without calling
    # super() still get the tenant-aware client.
    def _pre_setup(self):
        super()._pre_setup()
        self.client = APIClient(HTTP_X_TENANT_SCHEMA=self.tenant.schema_name)
