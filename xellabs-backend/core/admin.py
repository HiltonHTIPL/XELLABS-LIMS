from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, Client, Tenant

admin.site.site_header = "XelLabs LIMS Administration"
admin.site.site_title = "XelLabs LIMS"
admin.site.index_title = "Laboratory Management System"


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ("username", "email", "first_name", "last_name", "role", "is_active")
    list_filter = ("role", "is_active")
    fieldsets = UserAdmin.fieldsets + (
        ("XELLABS", {"fields": ("role", "phone", "department")}),
    )


@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "email", "is_active", "created_at")
    search_fields = ("name", "slug", "email")
    list_filter = ("is_active",)
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ("name", "email", "phone", "contact_person", "tenant", "is_active")
    search_fields = ("name", "email")
    list_filter = ("is_active", "tenant")
