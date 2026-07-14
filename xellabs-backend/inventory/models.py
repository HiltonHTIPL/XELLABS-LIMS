from django.db import models
from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.core.validators import MinValueValidator, MaxValueValidator


class StorageLocation(models.Model):
    LOCATION_TYPES = [
        ("building",     "Building"),
        ("room",         "Room"),
        ("fridge",       "Fridge"),
        ("freezer",      "Freezer"),
        ("cabinet",      "Cabinet"),
        ("shelf",        "Shelf"),
        ("box",          "Box"),
        ("box_location", "Box Location"),
    ]

    # Which location_type(s) a given type is allowed to sit under — mirrors
    # senaite.storage's real containment rules (confirmed via live testing: a
    # StorageSamplesContainer/box cannot be created directly under a
    # StoragePosition/room — "Creation of 'StorageSamplesContainer' in
    # '.../SP-xxxxx' is not allowed") plus the simpler rule that a room only
    # makes sense directly under a building, not nested inside a fridge/shelf/
    # etc. An empty set means "top-level only, no parent allowed."
    ALLOWED_PARENT_TYPES = {
        "building": set(),
        "room": {"building"},
        "fridge": {"building", "room"},
        "freezer": {"building", "room"},
        "cabinet": {"building", "room"},
        "shelf": {"building", "room", "fridge", "freezer", "cabinet", "shelf"},
        "box": {"fridge", "freezer", "cabinet", "shelf"},
        "box_location": {"box"},  # system-generated only, never chosen directly via the API
    }

    name          = models.CharField(max_length=200)
    location_type = models.CharField(max_length=50, default="building", choices=LOCATION_TYPES)
    parent        = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="children")
    temperature   = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True, validators=[MinValueValidator(-80), MaxValueValidator(150)], help_text="Temperature in Celsius (-80 to 150°C)")
    notes         = models.TextField(blank=True)
    # SENAITE metadata fields
    description        = models.TextField(blank=True)
    address            = models.CharField(max_length=500, blank=True)
    # Building (StorageFacility)-only fields — synced to SENAITE's Phone/EmailAddress.
    phone              = models.CharField(max_length=50, blank=True)
    email              = models.EmailField(blank=True)
    # SENAITE sync — senaite_path is the object's path under /senaite/senaite_storage
    # (e.g. "/senaite/senaite_storage/SF-00001/SC-00001"), cached at sync time so a
    # child node can build its own parent_path without a UID->path lookup round trip.
    senaite_uid   = models.CharField(max_length=100, blank=True)
    senaite_path  = models.CharField(max_length=500, blank=True)
    # Box-specific
    rows          = models.IntegerField(null=True, blank=True, validators=[MinValueValidator(1)])
    columns       = models.IntegerField(null=True, blank=True, validators=[MinValueValidator(1)])
    # Box location (slot) specific
    slot_id            = models.CharField(max_length=20, blank=True)
    is_occupied        = models.BooleanField(default=False)
    assigned_sample_id = models.CharField(max_length=200, blank=True)
    # Hidden system-generated scannable code (QR content). Never derived from the
    # user-editable name — names can duplicate across locations; this cannot.
    # Boxes: "BX-<pk>", slots: "<box label_code>-<slot_id>". Null for other types.
    label_code         = models.CharField(max_length=40, null=True, blank=True, unique=True)

    class Meta:
        db_table = "storage_locations"
        constraints = [
            models.CheckConstraint(
                condition=~models.Q(parent=models.F('id')),
                name='storage_location_no_self_parent',
            )
        ]
        indexes = [
            models.Index(fields=["parent"], name="storage_parent_idx"),
            models.Index(fields=["location_type"], name="storage_type_idx"),
            models.Index(fields=["is_occupied"], name="storage_occupied_idx"),
            models.Index(fields=["assigned_sample_id"], name="storage_sample_id_idx"),
        ]

    def clean(self):
        """Enforced automatically by Django admin/ModelForm via full_clean(). The
        API path enforces the same ALLOWED_PARENT_TYPES rule in
        StorageLocationSerializer.validate() so a violation there comes back as a
        proper JSON 400, not an uncaught ValidationError -> 500."""
        from django.core.exceptions import ValidationError
        if self.parent_id:
            allowed = self.ALLOWED_PARENT_TYPES.get(self.location_type, set())
            if self.parent.location_type not in allowed:
                raise ValidationError({
                    "parent": f"A '{self.get_location_type_display()}' cannot be placed under a "
                              f"'{self.parent.get_location_type_display()}'.",
                })
        elif self.ALLOWED_PARENT_TYPES.get(self.location_type):
            raise ValidationError({
                "parent": f"A '{self.get_location_type_display()}' requires a parent location.",
            })

    @staticmethod
    def slot_label_code(box, slot_id):
        """Scannable code for a box_location slot, derived from its box's code."""
        return f"{box.label_code}-{slot_id}" if box.label_code else None

    def __str__(self):
        return self.name


class InventoryItem(models.Model):
    """Abstract base for all consumable inventory item types."""
    name = models.CharField(max_length=200)
    cas_number = models.CharField(max_length=50, blank=True)
    manufacturer = models.CharField(max_length=200, blank=True)
    catalog_number = models.CharField(max_length=100, blank=True)
    unit = models.CharField(max_length=50, default="pcs")
    min_stock_level = models.DecimalField(max_digits=10, decimal_places=2, default=0, validators=[MinValueValidator(0)])
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
    quantity = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
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
    quantity = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
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
