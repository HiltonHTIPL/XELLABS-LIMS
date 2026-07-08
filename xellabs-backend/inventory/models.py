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

    def inherit_senaite_fields_from_ancestors(self):
        """Walk up the parent chain and fill any still-blank site/location/shelf
        tier this location doesn't own itself — same tier-ownership mapping as
        StorageModal.tsx's computeSenaiteDefaults() (room->site, fridge/freezer/
        cabinet->location, shelf->shelf), but applied server-side so it also
        covers box/box_location records the frontend form never creates directly
        (auto-generated slots, regenerate-slots) instead of only new-location
        form defaults."""
        need_site = not self.site_title
        need_loc = not self.location_title
        need_shelf = not self.shelf_title
        if not (need_site or need_loc or need_shelf):
            return

        node = self.parent
        while node and (need_site or need_loc or need_shelf):
            if need_site and node.location_type == 'room':
                self.site_title = node.site_title or node.name
                self.site_code = self.site_code or node.site_code
                self.site_description = self.site_description or node.site_description
                need_site = False
            elif need_loc and node.location_type in ('fridge', 'freezer', 'cabinet'):
                self.location_title = node.location_title or node.name
                self.location_code = self.location_code or node.location_code
                self.location_description = self.location_description or node.location_description
                self.senaite_location_type = self.senaite_location_type or node.senaite_location_type
                need_loc = False
            elif need_shelf and node.location_type == 'shelf':
                self.shelf_title = node.shelf_title or node.name
                self.shelf_code = self.shelf_code or node.shelf_code
                self.shelf_description = self.shelf_description or node.shelf_description
                need_shelf = False
            node = node.parent

    @staticmethod
    def slot_inherited_fields(parent):
        """Site/Location/Shelf tier fields a box_location slot should copy from
        its immediate parent box. The parent box will already carry its own
        owned/inherited tier values by the time this runs (save() populates
        them before the post_save signal that generates slots fires), so a
        slot only needs a direct copy — not its own ancestor walk."""
        return dict(
            site_title=parent.site_title, site_code=parent.site_code, site_description=parent.site_description,
            location_title=parent.location_title, location_code=parent.location_code,
            location_description=parent.location_description, senaite_location_type=parent.senaite_location_type,
            shelf_title=parent.shelf_title, shelf_code=parent.shelf_code, shelf_description=parent.shelf_description,
        )

    def save(self, *args, **kwargs):
        # Default the SENAITE title field this location "owns" to its own
        # name when left blank — mirrors StorageModal.tsx's ancestor-inherit
        # logic, but for the location's own record (a room has no ancestor
        # to inherit a site_title from, so without this it stays blank
        # forever and SENAITE's Site/Location/Shelf Title columns show empty).
        if self.location_type == 'room' and not self.site_title:
            self.site_title = self.name
        elif self.location_type in ('fridge', 'freezer', 'cabinet') and not self.location_title:
            self.location_title = self.name
        elif self.location_type == 'shelf' and not self.shelf_title:
            self.shelf_title = self.name

        # Types that don't own any tier (box, box_location) — and any location
        # missing a tier it doesn't own — inherit from the nearest qualifying
        # ancestor so SENAITE never shows blank Site/Location/Shelf Title.
        if self.parent_id:
            self.inherit_senaite_fields_from_ancestors()

        super().save(*args, **kwargs)

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
