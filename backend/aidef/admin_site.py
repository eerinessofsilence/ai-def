from django.contrib.admin import AdminSite


class AIDefAdminSite(AdminSite):
    index_template = "admin/custom_index.html"

    def has_permission(self, request):
        return request.user.is_active and request.user.is_staff and request.user.is_superuser
