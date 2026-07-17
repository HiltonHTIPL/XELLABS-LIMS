from django.db import models
from django.conf import settings
from django.utils import timezone


class InstrumentType(models.Model):
    """SENAITE-parity setup entity: groups instruments by type (e.g. GC-MS, HPLC)."""
    name = models.CharField(max_length=200, unique=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "instrument_types"
        ordering = ["name"]

    def __str__(self):
        return self.name


class InstrumentLocation(models.Model):
    """SENAITE-parity setup entity: the physical location an instrument sits in."""
    name = models.CharField(max_length=200, unique=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "instrument_locations"
        ordering = ["name"]

    def __str__(self):
        return self.name


class InstrumentManufacturer(models.Model):
    """SENAITE-parity setup catalog: instrument manufacturers."""
    name = models.CharField(max_length=200, unique=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "instrument_manufacturers"
        ordering = ["name"]

    def __str__(self):
        return self.name


class InstrumentSupplier(models.Model):
    """SENAITE-parity setup catalog: instrument suppliers/vendors."""
    name = models.CharField(max_length=200, unique=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "instrument_suppliers"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Instrument(models.Model):
    STATUS = [
        ("active", "Active"),
        ("inactive", "Inactive"),
        ("under_maintenance", "Under Maintenance"),
        ("out_of_service", "Out of Service"),
        ("retired", "Retired"),
    ]
    USABILITY = [
        ("valid", "Valid"),
        ("expired", "Expired"),
        ("out_of_service", "Out of Service"),
    ]
    name = models.CharField(max_length=200)
    instrument_id = models.CharField(max_length=50, unique=True)
    model = models.CharField(max_length=200, blank=True)
    manufacturer = models.CharField(max_length=200, blank=True)  # denormalized display cache
    manufacturer_org = models.ForeignKey(
        InstrumentManufacturer, on_delete=models.SET_NULL, null=True, blank=True, related_name="instruments"
    )
    serial_number = models.CharField(max_length=100, blank=True)
    instrument_type = models.ForeignKey(
        InstrumentType, on_delete=models.SET_NULL, null=True, blank=True, related_name="instruments"
    )
    instrument_location = models.ForeignKey(
        InstrumentLocation, on_delete=models.SET_NULL, null=True, blank=True, related_name="instruments"
    )
    supplier = models.CharField(max_length=200, blank=True)  # denormalized display cache
    supplier_org = models.ForeignKey(
        InstrumentSupplier, on_delete=models.SET_NULL, null=True, blank=True, related_name="instruments"
    )
    asset_number = models.CharField(max_length=100, blank=True)
    location = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=20, choices=STATUS, default="active")
    usability = models.CharField(
        max_length=20, choices=USABILITY, default="valid", db_index=True,
        help_text="Derived from status + latest calibration/certification/validation",
    )
    purchase_date = models.DateField(null=True, blank=True)
    installation_date = models.DateField(null=True, blank=True)
    installation_certificate = models.FileField(
        upload_to="instrument_install_certs/", null=True, blank=True
    )
    photo = models.ImageField(upload_to="instrument_photos/", null=True, blank=True)
    # Export/Import Data Interface vocabularies (interface module codes)
    data_interface = models.CharField(
        max_length=200, blank=True,
        help_text="Export data interface code",
    )
    import_data_interface = models.CharField(
        max_length=500, blank=True,
        help_text="Comma-separated import interface codes",
    )
    result_files_folder = models.TextField(
        blank=True,
        help_text="One line per import path: InterfaceCode|/path/to/folder",
    )
    data_interface_options = models.TextField(
        blank=True,
        help_text="Key=Value lines passed to export/import modules",
    )
    dispose_until_next_calibration = models.BooleanField(
        default=False,
        help_text="Unavailable until the next valid calibration",
    )
    inlab_calibration_procedure = models.TextField(blank=True)
    preventive_maintenance_procedure = models.TextField(blank=True)
    last_calibration = models.DateField(null=True, blank=True)
    next_calibration = models.DateField(null=True, blank=True)
    last_maintenance = models.DateField(null=True, blank=True)
    next_maintenance = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "instruments"
        indexes = [
            models.Index(fields=["status"], name="instrument_status_idx"),
            models.Index(fields=["next_calibration"], name="instrument_next_cal_idx"),
            models.Index(fields=["usability"], name="instrument_usability_idx"),
        ]

    def __str__(self):
        return f"{self.name} ({self.instrument_id})"

    @property
    def is_usable(self) -> bool:
        return self.usability == "valid" and self.status == "active"

    def save(self, *args, **kwargs):
        # Keep string caches in sync with catalog FKs for list/report columns.
        if self.manufacturer_org_id:
            self.manufacturer = self.manufacturer_org.name
        if self.supplier_org_id:
            self.supplier = self.supplier_org.name
        super().save(*args, **kwargs)


class InstrumentMethod(models.Model):
    instrument = models.ForeignKey(Instrument, on_delete=models.CASCADE, related_name="methods")
    method = models.ForeignKey("lims.Method", on_delete=models.CASCADE)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "instrument_methods"
        unique_together = ("instrument", "method")


class Calibration(models.Model):
    STATUS = [("passed", "Passed"), ("failed", "Failed"), ("pending", "Pending")]
    instrument = models.ForeignKey(Instrument, on_delete=models.CASCADE, related_name="calibrations")
    calibration_date = models.DateField()
    next_due = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS, default="pending")
    performed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    certificate = models.FileField(upload_to="calibrations/", null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "calibrations"
        ordering = ["-calibration_date"]


class Maintenance(models.Model):
    instrument = models.ForeignKey(Instrument, on_delete=models.CASCADE, related_name="maintenances")
    maintenance_date = models.DateField()
    next_due = models.DateField(null=True, blank=True)
    maintenance_type = models.CharField(max_length=50, default="routine",
                                        choices=[("routine", "Routine"), ("corrective", "Corrective"),
                                                 ("preventive", "Preventive")])
    performed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "maintenances"
        ordering = ["-maintenance_date"]


class InstrumentRun(models.Model):
    instrument = models.ForeignKey(Instrument, on_delete=models.CASCADE, related_name="runs")
    run_date = models.DateTimeField()
    method = models.ForeignKey("lims.Method", null=True, blank=True, on_delete=models.SET_NULL)
    operator = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "instrument_runs"


class InstrumentResultImport(models.Model):
    STATUS = [
        ("pending", "Pending"),
        ("processing", "Processing"),
        ("processed", "Processed"),
        ("failed", "Failed"),
    ]
    instrument = models.ForeignKey(Instrument, on_delete=models.CASCADE)
    file = models.FileField(upload_to="instrument_imports/")
    file_format = models.CharField(max_length=20, default="csv",
                                   choices=[("csv", "CSV"), ("xml", "XML"), ("txt", "Text")])
    status = models.CharField(max_length=10, choices=STATUS, default="pending")
    imported_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    error_log = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "instrument_result_imports"


class Certification(models.Model):
    """SENAITE-parity: an instrument's calibration/quality certification record."""
    instrument = models.ForeignKey(Instrument, on_delete=models.CASCADE, related_name="certifications")
    task_id = models.CharField(max_length=100, blank=True)
    internal = models.BooleanField(default=False, help_text="Internal certification vs external agency")
    agency = models.CharField(max_length=200, blank=True)
    date = models.DateField(null=True, blank=True)
    expiration_interval = models.PositiveIntegerField(
        null=True, blank=True, help_text="Days from Valid From until expiry (used if Valid To is blank)"
    )
    valid_from = models.DateField(null=True, blank=True)
    valid_to = models.DateField(null=True, blank=True)
    preparator = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    validator = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    document = models.FileField(upload_to="certifications/", null=True, blank=True)
    remarks = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "instrument_certifications"
        ordering = ["-valid_from"]

    @property
    def is_valid(self):
        """Certification is currently valid if today falls within its validity window."""
        today = timezone.now().date()
        if self.valid_from and today < self.valid_from:
            return False
        if self.valid_to and today > self.valid_to:
            return False
        return bool(self.valid_from)

    def __str__(self):
        return f"Certification {self.task_id or self.pk} ({self.instrument.name})"


class ScheduledTask(models.Model):
    """SENAITE-parity: a scheduled (recurring) maintenance/validation task for an instrument."""
    instrument = models.ForeignKey(Instrument, on_delete=models.CASCADE, related_name="scheduled_tasks")
    title = models.CharField(max_length=200)
    task_type = models.CharField(
        max_length=50, default="maintenance",
        choices=[("maintenance", "Maintenance"), ("calibration", "Calibration"), ("validation", "Validation")],
    )
    criteria = models.CharField(
        max_length=200, blank=True, help_text="Recurrence, e.g. 'every 30 days' or a cron-like rule"
    )
    considerations = models.TextField(blank=True)
    next_due = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "instrument_scheduled_tasks"
        ordering = ["next_due"]

    def __str__(self):
        return f"{self.title} ({self.instrument.name})"


class Validation(models.Model):
    """SENAITE-parity: an instrument validation record, including downtime tracking."""
    instrument = models.ForeignKey(Instrument, on_delete=models.CASCADE, related_name="validations")
    date_issued = models.DateField(null=True, blank=True)
    down_from = models.DateField(null=True, blank=True, help_text="Instrument out of service from")
    down_to = models.DateField(null=True, blank=True, help_text="Instrument back in service on")
    validator = models.CharField(max_length=200, blank=True)
    worker = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    work_performed = models.TextField(blank=True)
    considerations = models.TextField(blank=True)
    report_id = models.CharField(max_length=100, blank=True)
    remarks = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "instrument_validations"
        ordering = ["-date_issued"]

    def __str__(self):
        return f"Validation {self.report_id or self.pk} ({self.instrument.name})"
