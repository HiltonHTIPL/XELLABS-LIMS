from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, Client


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ("username", "email", "first_name", "last_name", "role", "is_active")
    list_filter = ("role", "is_active")
    fieldsets = UserAdmin.fieldsets + (
        ("XELLABS", {"fields": ("role", "phone", "department")}),
    )


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ("name", "email", "phone", "contact_person", "is_active")
    search_fields = ("name", "email")
    list_filter = ("is_active",)
