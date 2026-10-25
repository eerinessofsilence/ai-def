import html
import re

from .arms import LANGUAGES


def preview_fields(data, language, media):
    """Only unique values may point back to a field; repeated copy is ambiguous."""
    candidates = []

    def visit(value, path):
        if isinstance(value, dict):
            if "asset_id" in value or set(value) == {"path", "storage"}:
                key = value.get("asset_id") or ("stored:" if value.get("storage") else "legacy:") + value["path"]
                if media.get(key):
                    candidates.append({"path": path, "value": media[key], "kind": "image"})
            elif value and set(value).issubset(LANGUAGES) and "en" in value:
                from .pages import merge
                visit(merge(value["en"], value.get(language)), f"{path}.{language}")
            else:
                for key, child in value.items():
                    if key != "id":
                        visit(child, f"{path}.{key}" if path else key)
        elif isinstance(value, list):
            for index, child in enumerate(value):
                visit(child, f"{path}.{index}")
        elif isinstance(value, str):
            for part in [value, *re.split(r"</(?:p|li|h[1-6]|blockquote)>", value, flags=re.I)]:
                text = " ".join(html.unescape(re.sub(r"<[^>]*>", " ", part)).split())
                item = {"path": path, "value": text, "kind": "text"}
                if len(text) >= 3 and "{{" not in text and item not in candidates:
                    candidates.append(item)

    visit(data, "")
    counts = {}
    for item in candidates:
        key = (item["kind"], item["value"])
        counts.setdefault(key, set()).add(item["path"])
    return [item for item in candidates if len(counts[(item["kind"], item["value"])]) == 1]
