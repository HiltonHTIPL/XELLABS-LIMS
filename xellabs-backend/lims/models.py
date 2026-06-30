from django.db import models
from django.conf import settings


class SampleType(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    prefix = models.CharField(max_length=10, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "sample_types"

    def __str__(self):
        return self.name


class Method(models.Model):
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "methods"

    def __str__(self):
        return self.name


class Test(models.Model):
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True)
    unit = models.CharField(max_length=50, blank=True)
    method = models.ForeignKey(Method, null=True, blank=True, on_delete=models.SET_NULL)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "tests"

    def __str__(self):
        return self.name


class Specification(models.Model):
    test = models.ForeignKey(Test, on_delete=models.CASCADE, related_name="specifications")
    sample_type = models.ForeignKey(SampleType, on_delete=models.CASCADE)
    min_value = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    max_value = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    min_operator = models.CharField(max_length=5, default=">=")
    max_operator = models.CharField(max_length=5, default="<=")
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "specifications"


class Sample(models.Model):
    STATUS = [
        ("registered", "Registered"),
        ("received", "Received"),
        ("in_progress", "In Progress"),
        ("results_pending", "Results Pending"),
        ("reviewed", "Reviewed"),
        ("published", "Published"),
        ("rejected", "Rejected"),
        ("disposed", "Disposed"),
    ]
    sample_id = models.CharField(max_length=50, unique=True)
    client = models.ForeignKey("core.Client", on_delete=models.PROTECT, related_name="samples")
    sample_type = models.ForeignKey(SampleType, on_delete=models.PROTECT)
    description = models.TextField(blank=True)
    collection_date = models.DateTimeField(null=True, blank=True)
    received_date = models.DateTimeField(null=True, blank=True)
    expiry_date = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS, default="registered")
    storage_location = models.CharField(max_length=200, blank=True)
    barcode = models.CharField(max_length=100, blank=True)
    is_locked = models.BooleanField(default=False)
    locked_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                  on_delete=models.SET_NULL, related_name="samples_locked")
    locked_at = models.DateTimeField(null=True, blank=True)
    locked_reason = models.CharField(max_length=300, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="samples_created")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "samples"
        ordering = ["-created_at"]

    def __str__(self):
        return self.sample_id


class AnalysisRequest(models.Model):
    STATUS = [
        ("pending", "Pending"),
        ("in_progress", "In Progress"),
        ("completed", "Completed"),
        ("cancelled", "Cancelled"),
    ]
    ar_id = models.CharField(max_length=50, unique=True)
    sample = models.ForeignKey(Sample, on_delete=models.CASCADE, related_name="analysis_requests")
    tests = models.ManyToManyField(Test, related_name="analysis_requests")
    status = models.CharField(max_length=20, choices=STATUS, default="pending")
    priority = models.CharField(max_length=20, default="normal",
                                choices=[("low", "Low"), ("normal", "Normal"), ("high", "High"), ("urgent", "Urgent")])
    due_date = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "analysis_requests"
        ordering = ["-created_at"]

    def __str__(self):
        return self.ar_id


class Worksheet(models.Model):
    STATUS = [
        ("open", "Open"),
        ("in_progress", "In Progress"),
        ("to_be_verified", "To Be Verified"),
        ("verified", "Verified"),
        ("rejected", "Rejected"),
    ]
    ws_id = models.CharField(max_length=50, unique=True)
    analyst = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="worksheets")
    status = models.CharField(max_length=20, choices=STATUS, default="open")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "worksheets"
        ordering = ["-created_at"]

    def __str__(self):
        return self.ws_id


class WorksheetAssignment(models.Model):
    worksheet = models.ForeignKey(Worksheet, on_delete=models.CASCADE, related_name="assignments")
    analysis_request = models.ForeignKey(AnalysisRequest, on_delete=models.CASCADE)
    test = models.ForeignKey(Test, on_delete=models.PROTECT)
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "worksheet_items"


class Result(models.Model):
    STATUS = [
        ("pending", "Pending"),
        ("submitted", "Submitted"),
        ("verified", "Verified"),
        ("rejected", "Rejected"),
    ]
    worksheet_assignment = models.OneToOneField(WorksheetAssignment, on_delete=models.CASCADE, related_name="result")
    value = models.TextField(blank=True)
    unit = models.CharField(max_length=50, blank=True)
    status = models.CharField(max_length=20, choices=STATUS, default="pending")
    is_out_of_range = models.BooleanField(default=False)
    submitted_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                     on_delete=models.SET_NULL, related_name="results_submitted")
    verified_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name="results_verified")
    submitted_at = models.DateTimeField(null=True, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    remarks = models.TextField(blank=True)
    is_locked = models.BooleanField(default=False)

    class Meta:
        db_table = "results"


class QCSample(models.Model):
    QC_TYPE = [
        ("blank", "Blank"),
        ("control", "Control"),
        ("spike", "Spike"),
        ("duplicate", "Duplicate"),
        ("reference", "Reference Material"),
        ("calibrator", "Calibrator"),
    ]
    STATUS = [
        ("pending", "Pending"),
        ("passed", "Passed"),
        ("failed", "Failed"),
        ("warning", "Warning"),
    ]
    qc_id = models.CharField(max_length=50, unique=True)
    qc_type = models.CharField(max_length=20, choices=QC_TYPE)
    test = models.ForeignKey(Test, on_delete=models.PROTECT, related_name="qc_samples")
    worksheet = models.ForeignKey(Worksheet, null=True, blank=True, on_delete=models.SET_NULL, related_name="qc_samples")
    lot_number = models.CharField(max_length=100, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    target_value = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    tolerance_percent = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    actual_value = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS, default="pending")
    notes = models.TextField(blank=True)
    run_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                               on_delete=models.SET_NULL, related_name="qc_samples_run")
    run_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "qc_samples"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.qc_id} ({self.get_qc_type_display()})"


class ChainOfCustody(models.Model):
    ACTION = [
        ("collected", "Sample Collected"),
        ("transferred", "Transferred"),
        ("received", "Received at Lab"),
        ("stored", "Stored"),
        ("retrieved", "Retrieved from Storage"),
        ("analysed", "Sent for Analysis"),
        ("disposed", "Disposed"),
    ]
    sample = models.ForeignKey(Sample, on_delete=models.CASCADE, related_name="custody_records")
    action = models.CharField(max_length=20, choices=ACTION)
    from_location = models.CharField(max_length=200, blank=True)
    to_location = models.CharField(max_length=200, blank=True)
    transferred_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                       related_name="custody_transfers_made")
    received_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name="custody_transfers_received")
    temperature_c = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    condition = models.CharField(max_length=50, blank=True,
                                 choices=[("intact", "Intact"), ("damaged", "Damaged"), ("compromised", "Compromised")])
    notes = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "chain_of_custody_events"
        ordering = ["sample", "timestamp"]

    def __str__(self):
        return f"{self.sample.sample_id} — {self.get_action_display()} at {self.timestamp:%Y-%m-%d %H:%M}"
