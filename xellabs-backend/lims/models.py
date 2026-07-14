from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator


class SampleType(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    prefix = models.CharField(max_length=10)
    is_active = models.BooleanField(default=True)
    senaite_uid = models.CharField(max_length=100, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "sample_types"

    def __str__(self):
        return self.name


class SampleTemplate(models.Model):
    name = models.CharField(max_length=200, unique=True)
    description = models.TextField(blank=True)
    sample_type_uid = models.CharField(max_length=100, blank=True)
    sample_type_name = models.CharField(max_length=200, blank=True)
    sample_point_uid = models.CharField(max_length=100, blank=True)
    sample_point_name = models.CharField(max_length=200, blank=True)
    composite = models.BooleanField(default=False)
    sampling_required = models.BooleanField(default=False)
    auto_partition = models.BooleanField(default=False)
    # List of partition dicts: {part_id, container_uid, container_name,
    # preservation_uid, preservation_name, sample_type_uid, sample_type_name,
    # services: [{uid, title, hidden}]} — mirrors SENAITE's partitions DataGrid.
    partitions = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "sample_templates"
        ordering = ["name"]

    def __str__(self):
        return self.name


class AnalysisProfile(models.Model):
    name = models.CharField(max_length=200, unique=True)
    analysis_services = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "analysis_profiles"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Calculation(models.Model):
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=50, unique=True)
    formula = models.TextField(blank=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "calculations"

    def __str__(self):
        return self.name


class Method(models.Model):
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True)
    accredited = models.BooleanField(default=False)
    instructions = models.TextField(blank=True)
    document = models.FileField(upload_to="method_documents/", blank=True, null=True)
    calculations = models.ManyToManyField(Calculation, blank=True, related_name="methods")
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
    price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    method = models.ForeignKey(Method, null=True, blank=True, on_delete=models.SET_NULL)
    is_active = models.BooleanField(default=True)
    senaite_uid = models.CharField(max_length=100, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "tests"

    def __str__(self):
        return self.name


class Specification(models.Model):
    OPERATOR_CHOICES = [
        (">=", "Greater than or equal (>=)"),
        (">", "Greater than (>)"),
        ("<=", "Less than or equal (<=)"),
        ("<", "Less than (<)"),
    ]

    test = models.ForeignKey(Test, on_delete=models.CASCADE, related_name="specifications")
    sample_type = models.ForeignKey(SampleType, on_delete=models.CASCADE)
    min_value = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    max_value = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    min_operator = models.CharField(max_length=5, default=">=", choices=OPERATOR_CHOICES)
    max_operator = models.CharField(max_length=5, default="<=", choices=OPERATOR_CHOICES)
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
    CONDITION = [
        ("good", "Good"),
        ("acceptable", "Acceptable"),
        ("compromised", "Compromised"),
        ("not_acceptable", "Not Acceptable"),
    ]
    SEAL_CONDITION = [
        ("intact", "Intact"),
        ("broken", "Broken"),
        ("missing", "Missing"),
    ]
    DEVIATION = [
        ("none", "None"),
        ("temperature_excursion", "Temperature Excursion"),
        ("delayed_transport", "Delayed Transport"),
        ("haemolysis", "Haemolysis"),
    ]
    STORAGE_REQ = [
        ("2_8c", "2–8 °C (Refrigerated)"),
        ("minus_20c", "-20 °C (Frozen)"),
        ("minus_80c", "-80 °C (Ultra-frozen)"),
        ("room_temp", "Room Temperature"),
    ]
    PRIORITY = [
        ("high", "High"),
        ("medium", "Medium"),
        ("low", "Low"),
    ]
    QTY_UNIT = [
        ("tubes", "Tubes"),
        ("vials", "Vials"),
        ("bags", "Bags"),
        ("slides", "Slides"),
    ]

    sample_id = models.CharField(max_length=50, unique=True)
    client = models.ForeignKey("core.Client", on_delete=models.PROTECT, related_name="samples")
    sample_type = models.ForeignKey(SampleType, on_delete=models.PROTECT)
    description = models.TextField(blank=True)
    collection_date = models.DateTimeField(null=True, blank=True)
    received_date = models.DateTimeField(null=True, blank=True)
    expiry_date = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS, default="registered")
    # Authoritative only when a real StorageLocation slot is occupied — written
    # exclusively by inventory._assign_sample_to_slot / unassign. Never set at
    # registration time, so "Active" never means "merely intended".
    storage_location = models.CharField(max_length=200, blank=True)
    # Informational hint chosen at registration (New Sample), before the sample
    # physically exists — surfaced as a pre-fill suggestion on Sample Receipt.
    preferred_storage_location = models.CharField(max_length=200, blank=True)
    preferred_storage_label_code = models.CharField(max_length=40, blank=True)
    barcode = models.CharField(max_length=100, blank=True)
    # Receipt intake fields
    condition = models.CharField(max_length=20, choices=CONDITION, blank=True)
    seal_condition = models.CharField(max_length=20, choices=SEAL_CONDITION, blank=True)
    seal_number = models.CharField(max_length=100, blank=True)
    quantity_received = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    quantity_unit = models.CharField(max_length=20, choices=QTY_UNIT, blank=True)
    sampling_deviation = models.CharField(max_length=30, choices=DEVIATION, blank=True, default="none")
    storage_requirement = models.CharField(max_length=20, choices=STORAGE_REQ, blank=True)
    priority = models.CharField(max_length=10, choices=PRIORITY, blank=True, default="medium")
    hold_for_qa = models.BooleanField(default=False)
    collector = models.CharField(max_length=200, blank=True)
    received_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name="samples_received")
    receipt_notes = models.TextField(blank=True)
    # Extended intake fields
    contact_name = models.CharField(max_length=200, blank=True)
    cc_contact = models.CharField(max_length=200, blank=True)
    cc_emails = models.TextField(blank=True)
    batch_id = models.CharField(max_length=100, blank=True)
    batch_sub_group = models.CharField(max_length=100, blank=True)
    container_type = models.CharField(max_length=100, blank=True)
    preservation = models.CharField(max_length=100, blank=True)
    analysis_specification = models.CharField(max_length=100, blank=True)
    sample_point = models.CharField(max_length=200, blank=True)
    environmental_conditions = models.CharField(max_length=100, blank=True)
    composite = models.BooleanField(default=False)
    internal_use = models.BooleanField(default=False)
    client_order_number = models.CharField(max_length=100, blank=True)
    client_reference = models.CharField(max_length=200, blank=True)
    client_sample_id = models.CharField(max_length=100, blank=True)
    attachment = models.FileField(upload_to="sample_attachments/", null=True, blank=True)
    senaite_uid = models.CharField(max_length=100, blank=True, db_index=True)
    senaite_ar_id = models.CharField(max_length=100, blank=True)
    last_synced_from_senaite = models.DateTimeField(null=True, blank=True)
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
        indexes = [
            models.Index(fields=["status"], name="sample_status_idx"),
            models.Index(fields=["client"], name="sample_client_idx"),
            models.Index(fields=["created_at"], name="sample_created_at_idx"),
            models.Index(fields=["status", "client"], name="sample_status_client_idx"),
        ]

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
    senaite_uid = models.CharField(max_length=100, blank=True, db_index=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "analysis_requests"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["sample"], name="ar_sample_idx"),
            models.Index(fields=["status"], name="ar_status_idx"),
        ]

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
    instrument = models.ForeignKey(
        "instruments.Instrument", null=True, blank=True, on_delete=models.SET_NULL, related_name="worksheets",
    )
    method = models.ForeignKey(Method, null=True, blank=True, on_delete=models.SET_NULL, related_name="worksheets")
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
    # Defaulted from the parent worksheet's instrument/method at assignment-creation
    # time (see WorksheetAssignmentSerializer.create), then kept in sync whenever the
    # worksheet's own instrument/method changes (see WorksheetSerializer.update) —
    # mirrors SENAITE's cascade-to-analyses behavior. Independently overridable per row.
    instrument = models.ForeignKey(
        "instruments.Instrument", null=True, blank=True, on_delete=models.SET_NULL, related_name="worksheet_assignments",
    )
    method = models.ForeignKey(Method, null=True, blank=True, on_delete=models.SET_NULL, related_name="worksheet_assignments")
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "worksheet_items"
        indexes = [
            models.Index(fields=["worksheet"], name="wa_worksheet_idx"),
            models.Index(fields=["analysis_request"], name="wa_ar_idx"),
        ]


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
        indexes = [
            models.Index(fields=["status"], name="result_status_idx"),
        ]


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
    
    # Review fields
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name="qc_samples_reviewed")
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_notes = models.TextField(blank=True)
    is_reviewed = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "qc_samples"
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.qc_id:
            from .services import generate_qc_id
            self.qc_id = generate_qc_id()
        
        # Auto-calculate status when actual_value is provided
        if self.actual_value is not None and self.target_value is not None:
            from decimal import Decimal
            tol_fraction = Decimal(self.tolerance_percent or 0) / Decimal("100")
            lower_bound = Decimal(self.target_value) * (Decimal("1") - tol_fraction)
            upper_bound = Decimal(self.target_value) * (Decimal("1") + tol_fraction)
            actual_dec = Decimal(self.actual_value)
            if lower_bound <= actual_dec <= upper_bound:
                self.status = "passed"
            else:
                self.status = "failed"
                
        super().save(*args, **kwargs)

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
    temperature_c = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True, validators=[MinValueValidator(-80), MaxValueValidator(150)])
    condition = models.CharField(max_length=50, blank=True,
                                 choices=[("intact", "Intact"), ("damaged", "Damaged"), ("compromised", "Compromised")])
    notes = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "chain_of_custody_events"
        ordering = ["sample", "timestamp"]

    def __str__(self):
        return f"{self.sample.sample_id} — {self.get_action_display()} at {self.timestamp:%Y-%m-%d %H:%M}"
