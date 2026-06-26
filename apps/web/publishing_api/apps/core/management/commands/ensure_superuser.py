"""
Ensure a superuser exists with credentials from environment variables.

Reads DJANGO_SUPERUSER_USERNAME, DJANGO_SUPERUSER_EMAIL, and
DJANGO_SUPERUSER_PASSWORD from the environment. Creates the user
if missing, or syncs password and email if the user already exists.

Safe to run on every deploy (idempotent).
"""

import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

User = get_user_model()


class Command(BaseCommand):
    help = 'Ensure superuser from env vars exists with correct credentials.'

    def handle(self, *args, **options):
        username = os.environ.get('DJANGO_SUPERUSER_USERNAME')
        email = os.environ.get('DJANGO_SUPERUSER_EMAIL')
        password = os.environ.get('DJANGO_SUPERUSER_PASSWORD')

        if not all([username, email, password]):
            self.stdout.write(
                'Superuser env vars not set, skipping.'
            )
            return

        user = User.objects.filter(username=username).first()

        if user:
            user.set_password(password)
            user.email = email
            user.is_staff = True
            user.is_superuser = True
            user.save()
            self.stdout.write(self.style.SUCCESS(
                f'Superuser "{username}" synced from env vars.'
            ))
            return

        User.objects.create_superuser(
            username=username,
            email=email,
            password=password,
        )
        self.stdout.write(self.style.SUCCESS(
            f'Superuser "{username}" created successfully.'
        ))
