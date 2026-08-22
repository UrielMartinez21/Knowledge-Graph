from django.middleware.csrf import CsrfViewMiddleware


class CsrfExemptApiMiddleware(CsrfViewMiddleware):
    """Exempt /api/ routes from CSRF verification.

    Internal API consumed by A.X.O.N. and CLI via HTTPX (no browser cookies).
    """

    def process_view(self, request, callback, callback_args, callback_kwargs):
        if request.path.startswith("/api/"):
            return None
        return super().process_view(request, callback, callback_args, callback_kwargs)
