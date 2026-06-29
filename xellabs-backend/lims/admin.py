from django.contrib import admin
from .models import SampleType, Method, Test, Specification, Sample, AnalysisRequest, Worksheet, WorksheetAssignment, Result

admin.site.register(SampleType)
admin.site.register(Method)
admin.site.register(Test)
admin.site.register(Specification)


@admin.register(Sample)
class SampleAdmin(admin.ModelAdmin):
    list_display = ("sample_id", "client", "sample_type", "status", "created_at")
    list_filter = ("status", "sample_type")
    search_fields = ("sample_id", "barcode")


@admin.register(AnalysisRequest)
class AnalysisRequestAdmin(admin.ModelAdmin):
    list_display = ("ar_id", "sample", "status", "priority", "created_at")
    list_filter = ("status", "priority")


@admin.register(Worksheet)
class WorksheetAdmin(admin.ModelAdmin):
    list_display = ("ws_id", "analyst", "status", "created_at")
    list_filter = ("status",)


admin.site.register(WorksheetAssignment)
admin.site.register(Result)
