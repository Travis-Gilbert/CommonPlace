from django.test import TestCase
from apps.intake.models import RawSource


class RawSourceFieldsTest(TestCase):
    def test_create_url_source_with_new_fields(self):
        source = RawSource.objects.create(
            url="https://example.com/article",
            input_type="url",
            importance="medium",
            phase="inbox",
            scrape_status="pending",
        )
        self.assertEqual(source.input_type, "url")
        self.assertEqual(source.importance, "medium")
        self.assertEqual(source.phase, "inbox")
        self.assertEqual(source.scrape_status, "pending")
        self.assertEqual(source.connections, [])
        self.assertFalse(source.source_file)

    def test_create_file_source_without_url(self):
        source = RawSource.objects.create(
            input_type="file",
            phase="inbox",
        )
        self.assertEqual(source.url, "")
        self.assertEqual(source.input_type, "file")

    def test_phase_choices(self):
        self.assertEqual(RawSource.Phase.INBOX, "inbox")
        self.assertEqual(RawSource.Phase.REVIEW, "review")
        self.assertEqual(RawSource.Phase.DECIDED, "decided")

    def test_scrape_status_choices(self):
        self.assertEqual(RawSource.ScrapeStatus.PENDING, "pending")
        self.assertEqual(RawSource.ScrapeStatus.COMPLETE, "complete")
        self.assertEqual(RawSource.ScrapeStatus.FAILED, "failed")

    def test_importance_choices(self):
        self.assertEqual(RawSource.Importance.LOW, "low")
        self.assertEqual(RawSource.Importance.MEDIUM, "medium")
        self.assertEqual(RawSource.Importance.HIGH, "high")

    def test_default_values(self):
        source = RawSource.objects.create(url="https://example.com")
        self.assertEqual(source.phase, "inbox")
        self.assertEqual(source.scrape_status, "pending")
        self.assertEqual(source.importance, "medium")
        self.assertEqual(source.input_type, "url")
        self.assertEqual(source.connections, [])
