from django.contrib import admin

from apps.intake.models import RawSource


@admin.register(RawSource)
class RawSourceAdmin(admin.ModelAdmin):
    list_display = ("display_title", "phase", "decision", "importance", "og_site_name", "created_at")
    list_filter = ("phase", "decision", "importance", "scrape_status")
    search_fields = ("url", "og_title", "og_description")
    readonly_fields = (
        "og_title", "og_description", "og_image", "og_site_name",
        "scrape_status", "created_at", "updated_at",
    )

    fieldsets = (
        (None, {"fields": ("url", "source_file", "input_type", "phase")}),
        ("OG Metadata", {"fields": ("og_title", "og_description", "og_image", "og_site_name", "scrape_status")}),
        ("Enrichment", {"fields": ("importance", "tags", "connections")}),
        ("Triage", {"fields": ("decision", "decision_note", "decided_at", "promoted_source_slug")}),
        ("Timestamps", {"fields": ("created_at", "updated_at")}),
    )
