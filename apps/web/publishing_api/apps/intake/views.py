"""
Sourcebox views: kanban board, capture, card polling, detail panel, move, triage.

All views are login-protected. The board shows three columns (Inbox, Review, Decided).
Capture creates cards in Inbox with async OG scraping. Detail panel loads enrichment
form. Triage moves cards to Decided with accept/reject/defer.
"""

from django.contrib.auth.mixins import LoginRequiredMixin
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.template.response import TemplateResponse
from django.utils import timezone
from django.views import View

from apps.intake.forms import CaptureForm, EnrichmentForm, MoveForm, TriageForm
from apps.intake.models import RawSource
from apps.intake.services import promote_to_research, start_scrape_thread


class SourceboxBoardView(LoginRequiredMixin, View):
    """Main kanban board: three columns with cards grouped by phase."""

    def get(self, request):
        inbox = RawSource.objects.filter(phase=RawSource.Phase.INBOX)
        review = RawSource.objects.filter(phase=RawSource.Phase.REVIEW)
        decided = RawSource.objects.filter(phase=RawSource.Phase.DECIDED)[:50]

        return TemplateResponse(request, "intake/sourcebox.html", {
            "inbox_sources": inbox,
            "review_sources": review,
            "decided_sources": decided,
            "capture_form": CaptureForm(),
            "nav_section": "sourcebox",
        })


class SourceboxCaptureView(LoginRequiredMixin, View):
    """POST: add URLs (single or batch) or files. Returns card partials for Inbox."""

    def post(self, request):
        # Handle file upload
        if request.FILES.get("source_file"):
            uploaded = request.FILES["source_file"]
            source = RawSource.objects.create(
                source_file=uploaded,
                input_type=RawSource.InputType.FILE,
                phase=RawSource.Phase.INBOX,
                scrape_status=RawSource.ScrapeStatus.COMPLETE,
                og_title=uploaded.name,
            )
            return TemplateResponse(
                request,
                "intake/partials/inbox_card.html",
                {"source": source},
            )

        # Handle URL(s)
        form = CaptureForm(request.POST)
        if not form.is_valid():
            return HttpResponse(
                '<div class="text-error text-sm px-3 py-2">Invalid URL(s)</div>',
                status=422,
            )

        url_list = form.cleaned_data["url_list"]
        cards_html = []

        for url in url_list:
            existing = RawSource.objects.filter(url=url).first()
            if existing:
                cards_html.append(TemplateResponse(
                    request,
                    "intake/partials/inbox_card.html",
                    {"source": existing, "duplicate": True},
                ))
                continue

            source = RawSource.objects.create(
                url=url,
                input_type=RawSource.InputType.URL,
                phase=RawSource.Phase.INBOX,
                scrape_status=RawSource.ScrapeStatus.PENDING,
            )
            start_scrape_thread(source.pk)
            cards_html.append(TemplateResponse(
                request,
                "intake/partials/inbox_card.html",
                {"source": source},
            ))

        # Combine all card fragments into one response
        combined = "".join(card.render().content.decode() for card in cards_html)
        return HttpResponse(combined)


class SourceboxCardView(LoginRequiredMixin, View):
    """GET: returns a single card partial. Used by HTMX polling for scrape status."""

    def get(self, request, pk):
        source = get_object_or_404(RawSource, pk=pk)
        template = {
            RawSource.Phase.INBOX: "intake/partials/inbox_card.html",
            RawSource.Phase.REVIEW: "intake/partials/review_card.html",
            RawSource.Phase.DECIDED: "intake/partials/decided_card.html",
        }.get(source.phase, "intake/partials/inbox_card.html")

        response = TemplateResponse(request, template, {"source": source})

        # Stop polling once scrape is done
        if source.scrape_status != RawSource.ScrapeStatus.PENDING:
            response["HX-StopPolling"] = "true"

        return response


class SourceboxDetailView(LoginRequiredMixin, View):
    """GET: detail panel content. POST: save enrichment data."""

    def get(self, request, pk):
        source = get_object_or_404(RawSource, pk=pk)
        form = EnrichmentForm(initial={
            "importance": source.importance,
            "source_type": source.tags[0] if source.tags else "article",
            "tags_raw": ", ".join(source.tags) if source.tags else "",
            "decision_note": source.decision_note,
        })
        return TemplateResponse(request, "intake/partials/detail_panel.html", {
            "source": source,
            "enrichment_form": form,
        })

    def post(self, request, pk):
        source = get_object_or_404(RawSource, pk=pk)
        form = EnrichmentForm(request.POST)

        if form.is_valid():
            source.importance = form.cleaned_data["importance"]
            source.tags = form.cleaned_data["tag_list"]
            source.decision_note = form.cleaned_data.get("decision_note", "")
            source.save(update_fields=["importance", "tags", "decision_note"])

        # Return updated card for OOB swap + confirmation in panel
        return TemplateResponse(request, "intake/partials/detail_panel.html", {
            "source": source,
            "enrichment_form": form,
            "saved": True,
        })


class SourceboxMoveView(LoginRequiredMixin, View):
    """POST: move a card to a new phase (drag-and-drop or button)."""

    def post(self, request):
        form = MoveForm(request.POST)
        if not form.is_valid():
            return HttpResponse("Invalid move", status=422)

        source = get_object_or_404(RawSource, pk=form.cleaned_data["source_id"])
        new_phase = form.cleaned_data["phase"]
        source.phase = new_phase
        source.save(update_fields=["phase"])

        template = {
            RawSource.Phase.INBOX: "intake/partials/inbox_card.html",
            RawSource.Phase.REVIEW: "intake/partials/review_card.html",
            RawSource.Phase.DECIDED: "intake/partials/decided_card.html",
        }.get(new_phase, "intake/partials/inbox_card.html")

        return TemplateResponse(request, template, {"source": source})


class SourceboxTriageView(LoginRequiredMixin, View):
    """POST: accept/reject/defer a RawSource. Moves to Decided phase."""

    def post(self, request, pk):
        source = get_object_or_404(RawSource, pk=pk)
        form = TriageForm(request.POST)

        if not form.is_valid():
            return HttpResponse("Invalid form", status=422)

        source.decision = form.cleaned_data["decision"]
        source.decision_note = form.cleaned_data.get("decision_note", "")
        source.decided_at = timezone.now()
        source.phase = RawSource.Phase.DECIDED
        source.save()

        # On accept: promote to research_api
        promote_result = None
        if source.decision == RawSource.Decision.ACCEPTED:
            promote_result = promote_to_research(source)
            if slug := promote_result.get("slug"):
                source.promoted_source_slug = slug
                source.save(update_fields=["promoted_source_slug"])

        return TemplateResponse(
            request,
            "intake/partials/decided_card.html",
            {"source": source, "promote_result": promote_result},
        )
