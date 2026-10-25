from django.contrib import admin
from django.contrib.sitemaps.views import sitemap
from django.http import HttpResponseRedirect
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static

from .sitemaps import sitemaps
from cms.pages import public_page


urlpatterns = [
    path('admin/', lambda request: HttpResponseRedirect(settings.CMS_FRONTEND_URL), name='cms_entry'),
    re_path(r'^admin/.+$', lambda request: HttpResponseRedirect(settings.CMS_FRONTEND_URL)),
    path('cms/', lambda request: HttpResponseRedirect(settings.CMS_FRONTEND_URL), name='cms_dev_entry'),
    path('internal-admin/', admin.site.urls),
    path('tinymce/', include('tinymce.urls')),
    path('sitemap.xml', sitemap, {'sitemaps': sitemaps}, name='django.contrib.sitemaps.views.sitemap'),
    path('', include('main.urls', namespace='main')),
    path('', include('portal.urls', namespace='portal')),
    path('api/auth/', include('users.urls', namespace='users')),
    path('api/cms/', include('cms.urls', namespace='cms')),
    path('api/pages/<slug:site>/<slug:slug>/', public_page, name='public_page'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL,
                          document_root=settings.MEDIA_ROOT)
