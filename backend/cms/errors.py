class CMSProblem(Exception):
    def __init__(self, message, *, status=400, fields=None):
        self.message = message
        self.status = status
        self.fields = fields or {}
        super().__init__(message)
