from django.urls import path

from . import views, collections, inquiries, pages, accounts, assets, review, ordering, comparison, translation_review


app_name = "cms"
urlpatterns = [
    path("session/", views.session, name="session"),
    path("<slug:site>/products/", views.products, name="products"),
    path("<slug:site>/pages/", pages.pages, name="pages"),
    path("<slug:site>/members/", accounts.members, name="members"),
    path("<slug:site>/password/", accounts.password, name="password"),
    path("<slug:site>/inquiries/", inquiries.inquiry_list, name="inquiries"),
    path("<slug:site>/inquiries/<int:identifier>/", inquiries.inquiry_detail, name="inquiry"),
    path("<slug:site>/schema/<slug:kind>/", collections.schema, name="schema"),
    path("<slug:site>/<slug:kind>/reorder/", ordering.reorder, name="reorder"),
    path("<slug:site>/references/<slug:kind>/", collections.references, name="references"),
    path("<slug:site>/uploads/", views.upload, name="upload"),
    path("<slug:site>/assets/", assets.assets, name="assets"),
    path("<slug:site>/assets/<uuid:asset_id>/", assets.asset_detail, name="asset"),
    path("<slug:site>/documents/<uuid:document_id>/", views.document_detail, name="document"),
    path("<slug:site>/documents/<uuid:document_id>/history/", views.history, name="history"),
    path("<slug:site>/documents/<uuid:document_id>/history/<int:version>/", comparison.history_comparison, name="history-comparison"),
    path("<slug:site>/documents/<uuid:document_id>/preview/", views.preview, name="preview"),
    path("<slug:site>/documents/<uuid:document_id>/review/", review.publication_review, name="review"),
    path("<slug:site>/documents/<uuid:document_id>/website/", comparison.website_comparison, name="website-comparison"),
    path("<slug:site>/documents/<uuid:document_id>/translations/", translation_review.review_translation, name="translation-review"),
    path("<slug:site>/documents/<uuid:document_id>/<slug:action>/", views.document_action, name="action"),
    path("<slug:site>/<slug:kind>/", collections.collection, name="collection"),
]
