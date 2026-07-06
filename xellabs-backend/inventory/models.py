from django.db import models
from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType


class StorageLocation(models.Model):
    LOCATION_TYPES = [
        ("room",         "Room"),
        ("fridge",       "Fridge"),
        ("freezer",      "Freezer"),
        ("cabinet",      "Cabinet"),
        ("shelf",        "Shelf"),
        ("box",          "Box"),
        ("box_location", "Box Location"),
    ]

    name          = models.CharField(max_length=200)
    location_type = models.CharField(max_length=50, default="room", choices=LOCATION_TYPES)
    parent        = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="children")
    temperature   = models.CharField(max_length=50, blank=True)
    notes         = models.TextField(blank=True)
    # SENAITE metadata fields
    description        = models.TextField(blank=True)
    address            = models.CharField(max_length=500, blank=True)
    site_title         = models.CharField(max_length=200, blank=True)
    site_code          = models.CharField(max_length=100, blank=True)
    site_description   = models.TextField(blank=True)
    location_title     = models.CharField(max_length=200, blank=True)
    location_code      = models.CharField(max_length=100, blank=True)
    location_description = models.TextField(blank=True)
    senaite_location_type = models.CharField(max_length=100, blank=True)  # e.g. SafetyLevel1
    shelf_title        = models.CharField(max_length=200, blank=True)
    shelf_code         = models.CharField(max_length=100, blank=True)
    shelf_description  = models.TextField(blank=True)
    # SENAITE sync
    senaite_uid   = models.CharField(max_length=100, blank=True)
    # Box-specific
    rows          = models.IntegerField(null=True, blank=True)
    columns       = models.IntegerField(null=True, blank=True)
    # Box location (slot) specific
    slot_id            = models.CharField(max_length=20, blank=True)
    is_occupied        = models.BooleanField(default=False)
    assigned_sample_id = models.CharField(max_length=200, blank=True)

    class Meta:
        db_table = "storage_locations"
        constraints = [
            models.CheckConstraint(
                condition=~models.Q(parent=models.F('id')),
                name='storage_location_no_self_parent',
            )
        ]

    def __str__(self):
        return self.name


class InventoryItem(models.Model):
    """Abstract base for all consumable inventory item types."""
    name = models.CharField(max_length=200)
    cas_number = models.CharField(max_length=50, blank=True)
    manufacturer = models.CharField(max_length=200, blank=True)
    catalog_number = models.CharField(max_length=100, blank=True)
    unit = models.CharField(max_length=50, default="pcs")
    min_stock_level = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        abstract = True

    def __str__(self):
        return self.name


class Reagent(InventoryItem):
    grade = models.CharField(max_length=100, blank=True)
    concentration = models.CharField(max_length=100, blank=True)
    hazard_class = models.CharField(max_length=100, blank=True)

    class Meta:
        db_table = "reagents"


class Standard(InventoryItem):
    certified_value = models.CharField(max_length=200, blank=True)
    certified_uncertainty = models.CharField(max_length=100, blank=True)
    reference_material = models.CharField(max_length=200, blank=True)

    class Meta:
        db_table = "standards"


class Solvent(InventoryItem):
    grade = models.CharField(max_length=100, blank=True)
    purity = models.CharField(max_length=100, blank=True)
    flash_point = models.CharField(max_length=50, blank=True)

    class Meta:
        db_table = "solvents"


class Lot(models.Model):
    # Generic link to a Reagent, Standard, or Solvent
    content_type = models.ForeignKey(ContentType, on_delete=models.PROTECT)
    object_id = models.PositiveIntegerField()
    item = GenericForeignKey("content_type", "object_id")

    lot_number = models.CharField(max_length=100)
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    expiry_date = models.DateField(null=True, blank=True)
    storage_location = models.ForeignKey(StorageLocation, null=True, blank=True, on_delete=models.SET_NULL)
    received_date = models.DateField(auto_now_add=True)
    certificate_of_analysis = models.FileField(upload_to="coa/", null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)

    class Meta:
        db_table = "lots"
        unique_together = ("content_type", "object_id", "lot_number")
        indexes = [models.Index(fields=["content_type", "object_id"])]

    def __str__(self):
        return f"{self.item} - {self.lot_number}"


class InventoryTransaction(models.Model):
    TYPES = [
        ("in", "Received"),
        ("out", "Consumed"),
        ("adjust", "Adjustment"),
        ("dispose", "Disposed"),
    ]
    lot = models.ForeignKey(Lot, on_delete=models.CASCADE, related_name="transactions")
    transaction_type = models.CharField(max_length=10, choices=TYPES)
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    reference = models.CharField(max_length=200, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "inventory_transactions"


class ExpiryAlert(models.Model):
    lot = models.ForeignKey(Lot, on_delete=models.CASCADE)
    alert_date = models.DateField()
    is_acknowledged = models.BooleanField(default=False)
    acknowledged_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                        on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "expiry_alerts"
