import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    """
    Idempotent superadmin bootstrap, run on every container start (see the
    django service command in docker-compose.yml).

    Reads DJANGO_SUPERUSER_USERNAME / DJANGO_SUPERUSER_PASSWORD /
    DJANGO_SUPERUSER_EMAIL from the environment (set them in the project-root
    .env — never commit real values). The env vars are the source of truth:
    the password is re-synced on every start, so changing it in .env and
    restarting the container is all a new deployment needs.

    Skips silently when the env vars are absent so local setups without them
    keep working unchanged.
    """
    help = "Create or update the platform superadmin from DJANGO_SUPERUSER_* env vars."

    def handle(self, *args, **options):
        username = os.environ.get("DJANGO_SUPERUSER_USERNAME", "").strip()
        password = os.environ.get("DJANGO_SUPERUSER_PASSWORD", "")
        email = os.environ.get("DJANGO_SUPERUSER_EMAIL", "admin@xellabs.com").strip()

        if not username or not password:
            self.stdout.write("DJANGO_SUPERUSER_USERNAME/PASSWORD not set — skipping superadmin bootstrap.")
            return

        User = get_user_model()
        user, created = User.objects.get_or_create(
            username=username,
            defaults={"email": email, "role": "admin"},
        )
        user.is_superuser = True
        user.is_staff = True
        user.is_active = True
        if email:
            user.email = email
        user.set_password(password)
        user.save()
        self.stdout.write(self.style.SUCCESS(
            f"Superadmin '{username}' {'created' if created else 'updated'} from environment."
        ))
