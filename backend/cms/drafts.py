from .errors import CMSProblem


def initialise(document, backend, payload):
    """Create a named draft atomically; empty payloads remain compatible with API clients."""
    data = backend.empty()
    if "name" in payload:
        name = payload["name"]
        if not isinstance(name, str) or not name.strip() or len(name) > 255:
            raise CMSProblem("Enter a name of up to 255 characters.", status=422, fields={"name": "Enter a name of up to 255 characters."})
        if document.site == "arms":
            data["name"] = name.strip()
        else:
            key = "title" if document.kind == "articles" else "name"
            data["fields"][key]["en"] = name.strip()
    if "category" in payload:
        if document.site == "arms":
            data["category"] = payload["category"]
        elif "category" in data["fields"]:
            data["fields"]["category"] = payload["category"]
    template = payload.get("template", "blank")
    if template == "article" and document.kind == "articles":
        block = backend.empty(backend.definition["relations"]["blocks"], backend.model)
        block["fields"]["kind"] = "text"
        data["sections"]["blocks"] = [block]
    elif template != "blank":
        raise CMSProblem("Choose a supported starting layout.", status=422, fields={"template": "Choose a supported starting layout."})
    document.data = data
    try:
        document.data = backend.clean(data, document)
    except CMSProblem as error:
        if "fields.category" in error.fields:
            error.fields["category"] = error.fields.pop("fields.category")
        raise
    return document
