from django.db import models
from django.conf import settings


class Report(models.Model):
    STATUS = [("draft", "Draft"), ("final", "Final"), ("cancelled", "Cancelled")]
    REPORT_TYPES = [
        ("coa", "Certificate of Analysis"),
        ("worksheet", "Worksheet Report"),
        ("qc", "QC Report"),
        ("inventory", "Inventory Report"),
        ("instrument", "Instrument Report"),
        ("custom", "Custom Report"),
    ]
    report_id = models.CharField(max_length=50, unique=True)
    report_type = models.CharField(max_length=20, choices=REPORT_TYPES)
    title = models.CharField(max_length=300)
    sample = models.ForeignKey("lims.Sample", null=True, blank=True, on_delete=models.SET_NULL,
                               related_name="reports")
    status = models.CharField(max_length=10, choices=STATUS, default="draft")
    generated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    file = models.FileField(upload_to="reports/", null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "reports"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.report_id} - {self.title}"
