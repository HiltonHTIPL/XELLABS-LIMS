from django.contrib import admin
from .models import Report


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ("report_id", "report_type", "title", "status", "sample", "generated_by", "created_at")
    list_filter = ("report_type", "status")
    search_fields = ("report_id", "title")
    readonly_fields = ("created_at", "published_at")
