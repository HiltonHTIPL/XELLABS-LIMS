from django.db import models
from django.conf import settings


class Instrument(models.Model):
    STATUS = [
        ("active", "Active"),
        ("inactive", "Inactive"),
        ("maintenance", "Under Maintenance"),
        ("retired", "Retired"),
    ]
    name = models.CharField(max_length=200)
    instrument_id = models.CharField(max_length=50, unique=True)
    model = models.CharField(max_length=200, blank=True)
    manufacturer = models.CharField(max_length=200, blank=True)
    serial_number = models.CharField(max_length=100, blank=True)
    location = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=20, choices=STATUS, default="active")
    purchase_date = models.DateField(null=True, blank=True)
    last_calibration = models.DateField(null=True, blank=True)
    next_calibration = models.DateField(null=True, blank=True)
    last_maintenance = models.DateField(null=True, blank=True)
    next_maintenance = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "instruments"

    def __str__(self):
        return f"{self.name} ({self.instrument_id})"


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
    STATUS = [("pending", "Pending"), ("processed", "Processed"), ("failed", "Failed")]
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
