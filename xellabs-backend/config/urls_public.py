"""Public schema URL conf — serves the main domain (tenant management)."""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from core.views import UserMeView, FlexibleTokenView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/login/', FlexibleTokenView.as_view()),
    path('api/auth/me/', UserMeView.as_view()),
    path('api/', include('core.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
