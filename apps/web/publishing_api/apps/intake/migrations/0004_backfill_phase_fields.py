from django.db import migrations


def backfill_phase(apps, schema_editor):
    RawSource = apps.get_model("intake", "RawSource")
    # Already-decided sources
    RawSource.objects.exclude(decision="pending").update(
        phase="decided",
        scrape_status="complete",
        input_type="url",
    )
    # Pending sources
    RawSource.objects.filter(decision="pending").update(
        phase="inbox",
        scrape_status="complete",  # Already scraped synchronously
        input_type="url",
    )


class Migration(migrations.Migration):
    dependencies = [
        ("intake", "0003_delete_suggestedconnection"),
    ]

    operations = [
        migrations.RunPython(backfill_phase, migrations.RunPython.noop),
    ]
