# AI DEF — контекст для Claude

@AGENTS.md

Общая архитектура, контракты и правила работы находятся в корневом
`AGENTS.md`, подключённом выше. Прочитай его перед изменениями; если механизм
импорта недоступен, открой файл вручную. Этот документ — краткая навигация,
подробное описание архитектуры не дублируется.

## Обязательные правила

- Отвечай по-русски, если пользователь не попросил иначе.
- Сначала изучай реализацию, затем делай минимальное изменение по местному
  паттерну. Перед ручными правками сообщи, что меняешь; используй `apply_patch`.
- Сохраняй чужие изменения. Не добавляй соседние фичи, рефакторинг или новый стек.
- Без прямой просьбы не запускай tests/build/lint/typecheck, браузер и
  визуальные проверки; не пиши тестовые файлы и не делегируй работу агентам.
- Миграции БД, изменение данных, публикация и deployment требуют запроса,
  разрешающего соответствующее действие. Не выполняй разрушительные команды
  или откат чужих правок без явного разрешения.
- Не выдавай чтение кода за тестирование. В финале обозначай сделанное,
  проверку и её ограничения.

## Архитектура за один проход

Проект состоит из Vite React SPA и Django backend с PostgreSQL.
Редакторский интерфейс — Django admin. В production запрос идёт через
Traefik → Nginx → Gunicorn/Django; Nginx также раздаёт SPA и static/media.

| Область | Начальные файлы |
| --- | --- |
| Backend wiring | `backend/aidef/settings.py`, `urls.py`, `middleware.py` |
| Публичные каталоги/блог/обращения | `backend/main/models.py`, `api.py`, `urls.py`, `admin.py`, `translation.py` |
| Клиентский каталог | `backend/portal/models.py`, `api.py`, `admin.py`, `translation.py` |
| Email auth | `backend/users/models.py`, `serializers.py`, `views.py` |
| Admin infrastructure | `backend/aidef/admin_mixins.py`, `backend/templates/admin/`, `backend/main/static/admin/` |
| Frontend entry/routes | `frontend/src/main.tsx`, `App.tsx` |
| Страницы | `frontend/src/pages/` |
| Общий UI | `frontend/components/`, `hooks/`, `lib/` — рядом с `src` |
| Переводы/URL | `frontend/src/i18n.ts`, `src/locales/*/common.json`, Header |
| Стили | `frontend/src/index.css`, `frontend/lib/utils.ts` |
| Media variants | `backend/main/image_variants.py` |
| Deployment | Корневой Dockerfile, `backend/Dockerfile`, Compose и `frontend/nginx*.conf` |
| CI/CD | `.github/workflows/ci.yml`, `docker-publish.yml` |

## Контракты, которые легко перепутать

- Языки: `en/de/sk/es/fr/it`, fallback `en`. Английский URL без префикса,
  остальные с `/<lng>`. Только frontend на `arms.ai-def.com` также поддерживает
  `ru`; основной сайт и backend LANGUAGES не меняются. Используй helpers из `i18n.ts`.
- `main.Product`, `main.CivilProduct`, `portal.PortalProduct` — разные модели.
  Portal использует `main.Category`, но не наследует публичный продукт.
- Public/portal endpoints — ручные Django `JsonResponse` views; DRF используется
  в auth. Не добавляй предположения о DRF permissions, pagination или serializer.
- Списки `/api/items/`, `/api/civil-items/`, `/api/blog/posts/`,
  `/api/portal/products/` возвращают массивы. Detail определяется slug.
- Public detail блоки и portal `characteristics/modules` имеют разные формы;
  сверяй backend serialization с TS types и mapping конкретной страницы.
- `VITE_API_URL` у product pages/DroneCarousel уже включает `/api`.
  Остальные основные consumers нормализуют base и умеют fallback `/api`.
  У Vite нет dev proxy; env встраивается при build.
- Token auth использует `Authorization: Token ...`, `authToken`, `authUser`
  в local/session storage и событие `auth-updated`. Admin использует session.
- ContactRequest создаётся вместе с синхронным email внутри atomic transaction:
  ошибка email → HTTP 502 и rollback, отсутствие recipients → сохранение без письма.
- Для блога сохраняй совместимость `blocks`/`sections`, anchor IDs и hero media.
- Media optional; сохраняй null/empty handling, AbortController, порядок,
  lazy loading и UI fallbacks.

## Особенности текущего состояния

Это факты исходников, а не задачи на автоматическое исправление:

- Portal проверяет наличие token только в UI. Его GET endpoints на backend
  не проверяют авторизацию, frontend fetch не отправляет token.
- Signup в Auth не вызывает register API; backend register существует отдельно.
- Blog HTML выводится через `dangerouslySetInnerHTML`, декоратор не санитайзер.
- `specs` хранится в public models, но текущий public API его не выдаёт.
- В `.env.example` есть `MAIL_BACKEND`, а settings читает `EMAIL_BACKEND`.
- Обычный Compose требует внешних TLS-сертификатов и не публикует backend:8000.
  Production Compose использует Traefik и proxied Nginx.
- Домены также зашиты в Nginx/robots.txt, не только в Compose env.
- Lint и Django tests в CI допускают ошибки. Publish workflow независим от CI.
- `frontend/README.md` — шаблон Vite; актуальные команды и ограничения
  описаны в `AGENTS.md` и конфигурациях.

Подробные потоки, env, команды для запрошенной проверки и карта типичных
изменений — в `AGENTS.md`. Обновляй архитектуру там, а этот индекс — только
если меняются точки входа, правила или ключевые контракты.
