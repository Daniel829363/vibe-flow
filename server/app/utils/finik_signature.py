"""
Finik (AversPay QR) RSA-SHA256 signature service.
Handles signing outgoing requests and verifying incoming webhooks.
"""
import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

JSON_CANONICAL_FLAGS = json.dumps  # reference only; flags applied inline


def _sort_body_top_level(body: dict) -> dict:
    """Sort only the top-level keys of the body dict (Finik requirement)."""
    return dict(sorted(body.items(), key=lambda item: item[0]))


def _create_canonical_string(
    method: str,
    path: str,
    host: str,
    x_api_headers: dict,
    query_params: dict | None = None,
    body: dict | None = None,
) -> str:
    """Build the canonical string following Finik's spec."""
    data = method.lower() + "\n"
    data += path + "\n"

    # host + x-api-* headers sorted alphabetically, joined by &
    parts = [f"host:{host}"]
    sorted_headers = {}
    for name, value in x_api_headers.items():
        lower_name = name.lower()
        if lower_name.startswith("x-api-"):
            sorted_headers[lower_name] = str(value)
    for k in sorted(sorted_headers.keys()):
        parts.append(f"{k}:{sorted_headers[k]}")
    data += "&".join(parts) + "\n"

    # Query params
    if query_params:
        sorted_params = sorted(query_params.items(), key=lambda x: x[0])
        qparts = []
        for k, v in sorted_params:
            from urllib.parse import quote, unquote
            qparts.append(f"{quote(unquote(k), safe='')}" + "=" + f"{quote(unquote(v or ''), safe='')}")
        data += "&".join(qparts) + "\n"

    # Body (sort only top-level keys)
    if body:
        sorted_body = _sort_body_top_level(body)
        data += json.dumps(sorted_body, ensure_ascii=False, separators=(",", ":")).replace("\\/", "/")

    return data


def canonicalize_body(body: dict) -> dict:
    """Return body with top-level keys sorted (for JSON encoding)."""
    return _sort_body_top_level(body)


def sign_request(
    http_method: str,
    path: str,
    timestamp: str,
    body: dict | None = None,
    query_params: dict | None = None,
    host: str | None = None,
    api_key: str = "",
    private_key_path: str = "",
) -> str:
    """Sign an outgoing request to Finik API. Returns base64-encoded signature."""
    import os
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding

    if not host:
        host = os.getenv("FINIK_HOST", "api.acquiring.averspay.kg")
    if not api_key:
        api_key = os.getenv("FINIK_API_KEY", "")
    if not private_key_path:
        private_key_path = str(Path(__file__).resolve().parent.parent.parent / "storage" / "finik_private.pem")

    x_api_headers = {
        "x-api-key": api_key,
        "x-api-timestamp": timestamp,
    }

    canonical_string = _create_canonical_string(
        method=http_method,
        path=path,
        host=host,
        x_api_headers=x_api_headers,
        query_params=query_params,
        body=body,
    )

    logger.debug(f"Canonical string for signing:\n{canonical_string}")

    with open(private_key_path, "rb") as f:
        private_key = serialization.load_pem_private_key(f.read(), password=None)

    import base64
    signature = private_key.sign(
        canonical_string.encode("utf-8"),
        padding.PKCS1v15(),
        hashes.SHA256(),
    )
    return base64.b64encode(signature).decode("utf-8")


def verify_webhook(
    http_method: str,
    path: str,
    timestamp: str,
    signature_b64: str,
    body: dict,
    host: str,
    x_api_headers: dict | None = None,
    provider_public_key_path: str = "",
) -> bool:
    """Verify an incoming webhook signature from Finik."""
    import os
    import base64
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding

    try:
        if not provider_public_key_path:
            provider_public_key_path = os.getenv(
                "FINIK_PROVIDER_PUBLIC_KEY_PATH",
                str(Path(__file__).resolve().parent.parent.parent / "storage" / "finik_provider_public.pem"),
            )

        if not Path(provider_public_key_path).exists():
            logger.error(f"Finik provider public key file not found: {provider_public_key_path}")
            return False

        if x_api_headers is None:
            x_api_headers = {"x-api-timestamp": timestamp}

        canonical_string = _create_canonical_string(
            method=http_method,
            path=path,
            host=host,
            x_api_headers=x_api_headers,
            query_params=None,
            body=body,
        )

        with open(provider_public_key_path, "rb") as f:
            public_key = serialization.load_pem_public_key(f.read())

        signature_bytes = base64.b64decode(signature_b64.strip())

        public_key.verify(
            signature_bytes,
            canonical_string.encode("utf-8"),
            padding.PKCS1v15(),
            hashes.SHA256(),
        )
        return True

    except Exception as e:
        logger.error(f"Signature verification error: {e}")
        return False
