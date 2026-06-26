from django.contrib.auth import get_user_model
from django.test import TestCase, Client
from django.urls import reverse

from apps.intake.models import RawSource

User = get_user_model()


class SourceboxBoardViewTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="test", password="test")
        self.client = Client()
        self.client.login(username="test", password="test")

    def test_board_loads(self):
        response = self.client.get(reverse("intake:sourcebox"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Sourcebox")

    def test_board_has_three_columns(self):
        response = self.client.get(reverse("intake:sourcebox"))
        self.assertContains(response, "Inbox")
        self.assertContains(response, "Review")
        self.assertContains(response, "Decided")


class SourceboxCaptureViewTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="test", password="test")
        self.client = Client()
        self.client.login(username="test", password="test")

    def test_add_single_url(self):
        response = self.client.post(
            reverse("intake:sourcebox-add"),
            {"urls": "https://example.com/test"},
            HTTP_HX_REQUEST="true",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(RawSource.objects.count(), 1)
        source = RawSource.objects.first()
        self.assertEqual(source.phase, "inbox")
        self.assertEqual(source.scrape_status, "pending")

    def test_add_duplicate_url_returns_existing(self):
        RawSource.objects.create(url="https://example.com/dup")
        response = self.client.post(
            reverse("intake:sourcebox-add"),
            {"urls": "https://example.com/dup"},
            HTTP_HX_REQUEST="true",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(RawSource.objects.count(), 1)  # No new record


class SourceboxCardViewTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="test", password="test")
        self.client = Client()
        self.client.login(username="test", password="test")

    def test_card_polling_returns_card(self):
        source = RawSource.objects.create(url="https://example.com", scrape_status="pending")
        response = self.client.get(
            reverse("intake:sourcebox-card", kwargs={"pk": source.pk}),
            HTTP_HX_REQUEST="true",
        )
        self.assertEqual(response.status_code, 200)

    def test_card_complete_sends_stop_polling(self):
        source = RawSource.objects.create(
            url="https://example.com",
            scrape_status="complete",
            og_title="Test",
        )
        response = self.client.get(
            reverse("intake:sourcebox-card", kwargs={"pk": source.pk}),
            HTTP_HX_REQUEST="true",
        )
        self.assertEqual(response["HX-StopPolling"], "true")


class SourceboxMoveViewTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="test", password="test")
        self.client = Client()
        self.client.login(username="test", password="test")

    def test_move_inbox_to_review(self):
        source = RawSource.objects.create(url="https://example.com", phase="inbox")
        response = self.client.post(
            reverse("intake:sourcebox-move"),
            {"source_id": source.pk, "phase": "review"},
            HTTP_HX_REQUEST="true",
        )
        self.assertEqual(response.status_code, 200)
        source.refresh_from_db()
        self.assertEqual(source.phase, "review")


class SourceboxTriageViewTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="test", password="test")
        self.client = Client()
        self.client.login(username="test", password="test")

    def test_accept_moves_to_decided(self):
        source = RawSource.objects.create(url="https://example.com", phase="review")
        response = self.client.post(
            reverse("intake:sourcebox-triage", kwargs={"pk": source.pk}),
            {"decision": "accepted"},
            HTTP_HX_REQUEST="true",
        )
        self.assertEqual(response.status_code, 200)
        source.refresh_from_db()
        self.assertEqual(source.decision, "accepted")
        self.assertEqual(source.phase, "decided")
