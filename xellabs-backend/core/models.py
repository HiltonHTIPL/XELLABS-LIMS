from django.db import models
from django.contrib.auth.models import AbstractUser


class Tenant(models.Model):
    name = models.CharField(max_length=200, unique=True)
    slug = models.SlugField(max_length=100, unique=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    logo = models.ImageField(upload_to="tenant_logos/", null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "tenants"

    def __str__(self):
        return self.name


class User(AbstractUser):
    ROLES = [
        ("admin", "Administrator"),
        ("lab_manager", "Lab Manager"),
        ("analyst", "Analyst"),
        ("reviewer", "Reviewer"),
        ("client", "Client"),
        ("receptionist", "Receptionist"),
    ]
    role = models.CharField(max_length=20, choices=ROLES, default="analyst")
    phone = models.CharField(max_length=20, blank=True)
    department = models.CharField(max_length=100, blank=True)
    tenant = models.ForeignKey(Tenant, null=True, blank=True, on_delete=models.SET_NULL, related_name="users")

    class Meta:
        db_table = "core_users"

    def __str__(self):
        return f"{self.get_full_name()} ({self.role})"


class Client(models.Model):
    name = models.CharField(max_length=200)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    contact_person = models.CharField(max_length=100, blank=True)
    tenant = models.ForeignKey(Tenant, null=True, blank=True, on_delete=models.SET_NULL, related_name="clients")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "clients"

    def __str__(self):
        return self.name
