from django.urls import path

from apps.intake import views

app_name = "intake"

urlpatterns = [
    path("sourcebox/", views.SourceboxBoardView.as_view(), name="sourcebox"),
    path("sourcebox/add/", views.SourceboxCaptureView.as_view(), name="sourcebox-add"),
    path("sourcebox/card/<int:pk>/", views.SourceboxCardView.as_view(), name="sourcebox-card"),
    path("sourcebox/detail/<int:pk>/", views.SourceboxDetailView.as_view(), name="sourcebox-detail"),
    path("sourcebox/move/", views.SourceboxMoveView.as_view(), name="sourcebox-move"),
    path("sourcebox/triage/<int:pk>/", views.SourceboxTriageView.as_view(), name="sourcebox-triage"),
]
