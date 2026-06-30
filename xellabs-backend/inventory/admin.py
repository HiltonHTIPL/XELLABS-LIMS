from django.contrib import admin
from .models import StorageLocation, Reagent, Standard, Solvent, Lot, InventoryTransaction, ExpiryAlert


@admin.register(StorageLocation)
class StorageLocationAdmin(admin.ModelAdmin):
    list_display = ("name", "location_type", "parent", "temperature")
    list_filter = ("location_type",)
    search_fields = ("name",)


@admin.register(Reagent)
class ReagentAdmin(admin.ModelAdmin):
    list_display = ("name", "manufacturer", "catalog_number", "unit", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name", "catalog_number", "cas_number")


@admin.register(Standard)
class StandardAdmin(admin.ModelAdmin):
    list_display = ("name", "manufacturer", "catalog_number", "certified_value", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name", "catalog_number")


@admin.register(Solvent)
class SolventAdmin(admin.ModelAdmin):
    list_display = ("name", "manufacturer", "catalog_number", "grade", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name", "catalog_number")


@admin.register(Lot)
class LotAdmin(admin.ModelAdmin):
    list_display = ("lot_number", "content_type", "object_id", "quantity", "expiry_date", "storage_location")
    list_filter = ("content_type", "storage_location")
    search_fields = ("lot_number",)


@admin.register(InventoryTransaction)
class InventoryTransactionAdmin(admin.ModelAdmin):
    list_display = ("created_at", "lot", "transaction_type", "quantity", "created_by")
    list_filter = ("transaction_type",)
    readonly_fields = ("created_at",)


@admin.register(ExpiryAlert)
class ExpiryAlertAdmin(admin.ModelAdmin):
    list_display = ("lot", "alert_date", "is_acknowledged", "acknowledged_by")
    list_filter = ("is_acknowledged",)
