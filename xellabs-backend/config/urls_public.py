"""Public schema URL conf — serves the main domain (tenant management)."""
from django.contrib import admin
from django.urls import path, include
from rest_framework.authtoken.views import obtain_auth_token
from core.views import UserMeView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/login/', obtain_auth_token),
    path('api/auth/me/', UserMeView.as_view()),
    path('api/', include('core.urls')),
]
