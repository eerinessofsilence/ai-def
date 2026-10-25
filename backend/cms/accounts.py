from django.contrib.auth import get_user_model, update_session_auth_hash
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.debug import sensitive_post_parameters

from .errors import CMSProblem
from .models import WorkspaceAccess
from .views import access, body, endpoint


@sensitive_post_parameters()
@endpoint(["POST"])
def password(request, site):
    access(request, site)
    values = body(request)
    old, new = values.get("current_password"), values.get("new_password")
    if not isinstance(old, str) or len(old) > 1024 or not request.user.check_password(old):
        raise CMSProblem("Check the highlighted fields.", status=422, fields={"current_password": "The current password is incorrect."})
    if not isinstance(new, str) or len(new) > 1024:
        raise CMSProblem("Check the highlighted fields.", status=422, fields={"new_password": "Enter a password of up to 1,024 characters."})
    try:
        validate_password(new, request.user)
    except ValidationError as error:
        raise CMSProblem("Check the highlighted fields.", status=422, fields={"new_password": " ".join(error.messages)}) from error
    request.user.set_password(new)
    request.user.save(update_fields=["password"])
    update_session_auth_hash(request, request.user)
    return JsonResponse({"ok": True})


@sensitive_post_parameters()
@endpoint(["GET", "POST", "PUT", "DELETE"])
def members(request, site):
    access(request, site, "manage")
    User = get_user_model()
    if request.method != "GET":
        values = body(request)
        role = values.get("role", "editor")
        if role not in WorkspaceAccess.Role.values:
            raise CMSProblem("Check the highlighted fields.", status=422, fields={"role": "Select a team member role."})
        if request.method == "POST":
            email, name, password = values.get("email"), values.get("name", ""), values.get("password", "")
            if not isinstance(email, str) or not isinstance(name, str) or not isinstance(password, str) or len(password) > 1024:
                raise CMSProblem("Check the team member details.", status=422)
            email = email.strip().lower()
            user = User.objects.filter(email__iexact=email).first()
            if user is None:
                user = User(email=email, first_name=name.strip()[:30], is_staff=True)
                try:
                    validate_password(password, user)
                except ValidationError as error:
                    raise CMSProblem("Check the highlighted fields.", status=422, fields={"password": " ".join(error.messages)}) from error
                user.set_password(password)
                user.full_clean()
                user.save()
            elif not user.is_staff or not user.is_active:
                raise CMSProblem("This is not an active staff account. Contact an administrator.", status=422)
            if user.is_superuser:
                raise CMSProblem("Administrators already have access to all sites.", status=422)
            WorkspaceAccess.objects.get_or_create(user=user, site=site, defaults={"role": role})
        else:
            identifier = values.get("user_id")
            if type(identifier) is not int:
                raise CMSProblem("Select a team member.")
            grant = get_object_or_404(WorkspaceAccess.objects.select_for_update(), user_id=identifier, site=site)
            if grant.user_id == request.user.pk:
                raise CMSProblem("You cannot change or remove your own access. Ask another administrator.", status=422)
            if request.method == "DELETE":
                grant.delete()
            else:
                grant.role = role
                grant.save(update_fields=["role"])
    return JsonResponse({"items": [{"id": grant.user_id, "name": grant.user.get_full_name() or grant.user.email, "email": grant.user.email, "role": grant.role}
                                   for grant in WorkspaceAccess.objects.filter(site=site).select_related("user").order_by("pk")]})
