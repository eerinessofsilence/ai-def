"""Review the saved draft against live content without committing a publication."""
import copy

from django.core.exceptions import ValidationError
from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import get_object_or_404

from main.arms_models import ArmsProduct

from .errors import CMSProblem
from .views import adapter, assert_version, body, endpoint, locked_document, representation
from .comparison import reference_labels


@endpoint(["POST"])
def publication_review(request, site, document_id):
    document = locked_document(request, site, document_id, lock=True)
    assert_version(document, body(request))
    backend = adapter(site, document.kind)
    baseline = None
    if document.target_id:
        obj = get_object_or_404(getattr(backend, "model", ArmsProduct), pk=document.target_id)
        if backend.live_fingerprint(obj) != document.live_fingerprint:
            raise CMSProblem("The website version changed outside CMS. Keep your draft and open the latest version before reviewing.", status=409)
        if document.published_data is not None:
            baseline = backend.snapshot(obj)

    problems, message = {}, ""
    try:
        # Use the real publication rules, including model validation and related rows.
        # The savepoint is always rolled back, as in the existing public preview.
        with transaction.atomic():
            backend.publish(copy.deepcopy(document))
            transaction.set_rollback(True)
    except CMSProblem as error:
        if error.status != 422:
            raise
        problems, message = error.fields, error.message
    except ValidationError as error:
        problems = {key: " ".join(value) for key, value in error.message_dict.items()} if hasattr(error, "message_dict") else {}
        message = "Check the highlighted fields before publishing."

    media = representation(document, request, include_review=False)["media"]
    if baseline is not None:
        published_document = copy.copy(document)
        published_document.data = baseline
        media.update(representation(published_document, request, include_review=False)["media"])
    affected = []
    if document.kind == "modules" and document.target_id:
        from portal.models import PortalProduct
        affected = [{"id": row.pk, "name": row.name_en or row.name, "available": row.available}
                    for row in PortalProduct.objects.filter(module_placements__module_id=document.target_id).distinct().order_by("order", "pk")]
    return JsonResponse({"version": document.version, "before": baseline, "after": document.data,
                         "media": media, "ready": not message, "error": message, "fields": problems,
                         "affected": affected, "reference_labels": reference_labels(document.kind, baseline, document.data)})
