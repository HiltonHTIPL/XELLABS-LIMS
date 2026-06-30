from django.contrib import admin
from .models import Instrument, InstrumentMethod, Calibration, Maintenance, InstrumentRun, InstrumentResultImport


class CalibrationInline(admin.TabularInline):
    model = Calibration
    extra = 0
    readonly_fields = ("calibration_date", "status", "performed_by", "created_at")
    ordering = ("-calibration_date",)


class MaintenanceInline(admin.TabularInline):
    model = Maintenance
    extra = 0
    readonly_fields = ("maintenance_date", "maintenance_type", "performed_by", "created_at")
    ordering = ("-maintenance_date",)


@admin.register(Instrument)
class InstrumentAdmin(admin.ModelAdmin):
    list_display = ("instrument_id", "name", "manufacturer", "status", "last_calibration", "next_calibration")
    list_filter = ("status",)
    search_fields = ("instrument_id", "name", "serial_number")
    inlines = [CalibrationInline, MaintenanceInline]


@admin.register(Calibration)
class CalibrationAdmin(admin.ModelAdmin):
    list_display = ("instrument", "calibration_date", "next_due", "status", "performed_by")
    list_filter = ("status", "instrument")
    readonly_fields = ("created_at",)


@admin.register(Maintenance)
class MaintenanceAdmin(admin.ModelAdmin):
    list_display = ("instrument", "maintenance_date", "next_due", "maintenance_type", "performed_by")
    list_filter = ("maintenance_type", "instrument")
    readonly_fields = ("created_at",)


@admin.register(InstrumentMethod)
class InstrumentMethodAdmin(admin.ModelAdmin):
    list_display = ("instrument", "method", "is_active")
    list_filter = ("is_active",)


@admin.register(InstrumentRun)
class InstrumentRunAdmin(admin.ModelAdmin):
    list_display = ("instrument", "run_date", "method", "operator")
    list_filter = ("instrument",)
    readonly_fields = ("created_at",)


@admin.register(InstrumentResultImport)
class InstrumentResultImportAdmin(admin.ModelAdmin):
    list_display = ("instrument", "file_format", "status", "imported_by", "created_at")
    list_filter = ("status", "file_format")
    readonly_fields = ("created_at",)
