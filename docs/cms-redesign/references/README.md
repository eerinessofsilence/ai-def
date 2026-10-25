# Пять референсов

Это ровно кандидаты №1–5 из согласованной подборки. Имена и ссылки ниже —
первоисточники; требования к AI DEF в соседних документах — проектные решения,
а не описание функций этих продуктов.

| ID | Работа и автор | Роль в задании | Локальный разбор |
| --- | --- | --- | --- |
| R1 | [CMS Design — Jurgen Ploeger](https://dribbble.com/shots/10475418-CMS-Design) | Структура формы и блочного редактора | [01-cms-design](01-cms-design/README.md) |
| R2 | [CMS edit — Untitled UI — Jordan Hughes](https://dribbble.com/shots/26333078-CMS-edit-Untitled-UI) | Визуальная иерархия и действия редактора | [02-untitled-ui](02-untitled-ui/README.md) |
| R3 | [Video CMS for Uscreen — Danilo Tanic / FineTune](https://dribbble.com/shots/24405676-Video-CMS-for-Uscreen) | Списки и плотность информации | [03-uscreen](03-uscreen/README.md) |
| R4 | [Contentstack CMS Design System — Media Cards (Finalized) — Max Burnside](https://dribbble.com/shots/15606377-Contentstack-CMS-Design-System-Media-Cards-Finalized) | Медиакарточки и их состояния | [04-contentstack-media](04-contentstack-media/README.md) |
| R5 | [W2K CMS — Article localization review editor — Thuan Nguyen](https://dribbble.com/shots/6574067-W2K-CMS-Article-localization-review-editor) | Сравнение оригинала и перевода | [05-w2k-localization](05-w2k-localization/README.md) |

## Единая композиция

R1 задаёт распределение информации, R2 — оформление, R3 — устройство списков,
R4 — взаимодействие с файлами, R5 — переводческий режим. Не смешивать пять
палитр, пять сайдбаров и разные стили кнопок. Все экраны получают одни токены,
одинаковые состояния и одинаковые названия действий.

Макеты с Dribbble используются для изучения визуальных решений. Локальные копии
сохраняют авторство; они не становятся ассетами интерфейса AI DEF. Не переносить
в продукт чужие фотографии, логотипы, демонстрационные данные или платный UI kit.
Никаких покупок или скачивания закрытых Figma-файлов задание не требует.

## Медиа в этой папке

`reference.*` — публичное изображение соответствующей работы, сохранённое без
перерисовки. `assets.json` фиксирует страницу, прямой URL, имя файла, размер и
SHA-256. Это изображения работ, а не скриншоты текущей CMS AI DEF.

Превью может быть статическим кадром анимированной работы. Функции референса,
которые не видны на сохранённом изображении, не считать подтверждёнными.
Интерактивность продукта, его доступность и исходный код не проверялись.
