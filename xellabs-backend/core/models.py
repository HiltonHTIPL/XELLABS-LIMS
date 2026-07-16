from django.db import models
from django.contrib.auth.models import AbstractUser
from django_tenants.models import TenantMixin, DomainMixin
from django.core.validators import MinValueValidator, MaxValueValidator, RegexValidator


class Tenant(TenantMixin):
    """
    Each Tenant is a lab organisation with its own isolated PostgreSQL schema.
    schema_name (from TenantMixin) = the PostgreSQL schema, e.g. 'greenvalley'
    """
    name = models.CharField(max_length=200, unique=True)
    slug = models.SlugField(max_length=100, unique=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    logo = models.ImageField(upload_to="tenant_logos/", null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # auto-create the schema when a Tenant record is saved
    auto_create_schema = True

    class Meta:
        db_table = "tenants"

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        from django.db import transaction
        # Use slug as the schema name (lowercase, no spaces)
        if not self.schema_name:
            self.schema_name = self.slug
        is_new = self.pk is None
        # Wrap entire operation in transaction so if domain creation fails,
        # the Tenant is rolled back too (prevents orphaned records)
        with transaction.atomic():
            super().save(*args, **kwargs)
            # Auto-register localhost and xellabs.com subdomains on first save
            if is_new and self.schema_name != 'public':
                from django.apps import apps
                DomainModel = apps.get_model('core', 'Domain')
                import os
                # Only create localhost domain in development (when DEBUG=True or in local env)
                if os.environ.get('DEBUG', 'False') == 'True':
                    DomainModel.objects.get_or_create(
                        domain=f'{self.slug}.localhost',
                        defaults={'tenant': self, 'is_primary': True},
                    )
                # Always create xellabs.com domain
                DomainModel.objects.get_or_create(
                    domain=f'{self.slug}.xellabs.com',
                    defaults={'tenant': self, 'is_primary': is_new},
                )


class Domain(DomainMixin):
    """
    Maps a domain/subdomain to a Tenant.
    e.g. greenvalley.xellabs.com  →  Tenant(schema_name='greenvalley')
    """
    class Meta:
        db_table = "tenant_domains"


class User(AbstractUser):
    ROLES = [
        ("admin", "Administrator"),
        ("lab_manager", "Lab Manager"),
        ("analyst", "Analyst"),
        ("reviewer", "Reviewer"),
        ("client", "Client"),
        ("receptionist", "Receptionist"),
    ]
    role = models.CharField(max_length=20, choices=ROLES, default="analyst")
    phone = models.CharField(max_length=20, blank=True)
    department = models.CharField(max_length=100, blank=True)
    tenant = models.ForeignKey(
        Tenant, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="users"
    )

    class Meta:
        db_table = "core_users"

    def __str__(self):
        return f"{self.get_full_name()} ({self.role})"


class Client(models.Model):
    """
    A client organisation that submits samples to the lab.
    Fields map 1-to-1 to SENAITE's Client content type for bi-directional sync.
    Lives in the public schema; scoped to a tenant via FK.
    """
    SALUTATION_CHOICES = [
        ('', '—'),
        ('Mr', 'Mr'),
        ('Mrs', 'Mrs'),
        ('Ms', 'Ms'),
        ('Dr', 'Dr'),
        ('Prof', 'Prof'),
    ]

    ORGANIZATION_TYPE_CHOICES = [
        ('', '—'),
        ('Pharmaceutical', 'Pharmaceutical'),
        ('Biotechnology', 'Biotechnology'),
        ('Environmental', 'Environmental'),
        ('Healthcare', 'Healthcare'),
        ('Food & Beverage', 'Food & Beverage'),
        ('Academic', 'Academic'),
        ('Government', 'Government'),
        ('Other', 'Other'),
    ]

    # ── Core identifiers ─────────────────────────────────────────────────────
    name = models.CharField(max_length=200)               # SENAITE: title
    client_id = models.CharField(max_length=50, blank=True, unique=True)  # SENAITE: ClientID
    organization_type = models.CharField(max_length=50, blank=True, choices=ORGANIZATION_TYPE_CHOICES)

    # ── Organisation contact ──────────────────────────────────────────────────
    email = models.EmailField(blank=True)                  # SENAITE: EmailAddress
    phone = models.CharField(max_length=30, blank=True, validators=[RegexValidator(r'^[\d\s\-\+\(\)]*$', 'Enter a valid phone number.')])   # SENAITE: Phone
    fax = models.CharField(max_length=30, blank=True, validators=[RegexValidator(r'^[\d\s\-\+\(\)]*$', 'Enter a valid fax number.')])     # SENAITE: Fax
    mobile = models.CharField(max_length=30, blank=True, validators=[RegexValidator(r'^[\d\s\-\+\(\)]*$', 'Enter a valid mobile number.')])  # SENAITE: MobilePhone

    # ── Primary contact person ────────────────────────────────────────────────
    contact_person = models.CharField(max_length=100, blank=True)   # legacy full name
    salutation = models.CharField(max_length=10, blank=True, choices=SALUTATION_CHOICES)  # SENAITE: Salutation
    contact_first_name = models.CharField(max_length=100, blank=True)   # SENAITE: Firstname
    contact_last_name = models.CharField(max_length=100, blank=True)    # SENAITE: Surname
    contact_email = models.EmailField(blank=True)                        # SENAITE: contact EmailAddress
    contact_phone = models.CharField(max_length=30, blank=True, validators=[RegexValidator(r'^[\d\s\-\+\(\)]*$', 'Enter a valid phone number.')])  # SENAITE: contact Phone
    contact_job_title = models.CharField(max_length=100, blank=True)     # SENAITE: JobTitle
    contact_department = models.CharField(max_length=100, blank=True)    # SENAITE: Department
    cc_emails = models.TextField(blank=True)                             # SENAITE: CCEmails (comma-separated)

    # ── Addresses (each mirrors SENAITE's address dict schema) ────────────────
    # Expected shape: {"address": "", "city": "", "state": "", "zip": "", "country": ""}
    address = models.TextField(blank=True)                           # legacy flat address
    physical_address = models.JSONField(default=dict, blank=True)   # SENAITE: PhysicalAddress
    postal_address = models.JSONField(default=dict, blank=True)     # SENAITE: PostalAddress
    billing_address = models.JSONField(default=dict, blank=True)    # SENAITE: BillingAddress

    # ── Financial / accounting ────────────────────────────────────────────────
    tax_number = models.CharField(max_length=50, blank=True)        # SENAITE: TaxNumber
    account_number = models.CharField(max_length=50, blank=True)    # SENAITE: AccountNumber
    bank_name = models.CharField(max_length=100, blank=True)        # SENAITE: BankName
    bank_branch = models.CharField(max_length=100, blank=True)      # SENAITE: BankBranch
    swift_code = models.CharField(max_length=20, blank=True)        # SENAITE: SWIFTcode
    iban = models.CharField(max_length=50, blank=True)              # SENAITE: IBAN
    nib = models.CharField(max_length=50, blank=True)               # SENAITE: NIB
    bulk_discount = models.DecimalField(max_digits=5, decimal_places=2, default=0, validators=[MinValueValidator(0), MaxValueValidator(100)])    # SENAITE: BulkDiscount (0-100%)
    member_discount = models.DecimalField(max_digits=5, decimal_places=2, default=0, validators=[MinValueValidator(0), MaxValueValidator(100)])  # SENAITE: MemberDiscount (0-100%)

    # ── Notes & SENAITE sync ──────────────────────────────────────────────────
    remarks = models.TextField(blank=True)                          # SENAITE: Remarks
    senaite_uid = models.CharField(max_length=100, blank=True)     # UID assigned after SENAITE sync
    cc_emails = models.TextField(blank=True, default="")           # CC notification list
    organization_type = models.CharField(max_length=100, blank=True, default="")

    # ── Meta ──────────────────────────────────────────────────────────────────
    tenant = models.ForeignKey(
        Tenant, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="clients"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "clients"

    def __str__(self):
        return self.name
