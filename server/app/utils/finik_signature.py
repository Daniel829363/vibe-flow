"""
Finik (AversPay QR) RSA-SHA256 signature service.
Handles signing outgoing requests and verifying incoming webhooks.
"""
import os
import json
import base64
import logging
from pathlib import Path
from urllib.parse import quote, unquote

logger = logging.getLogger(__name__)


def _sort_body_top_level(body: dict) -> dict:
    """Sort only the top-level keys of the body dict (Finik requirement)."""
    return dict(sorted(body.items(), key=lambda item: str(item[0])))


def _create_canonical_string(
    method: str,
    path: str,
    host: str,
    x_api_headers: dict,
    query_params: dict | None = None,
    body: dict | None = None,
) -> str:
    """Build the canonical string following Finik's spec (matching PHP/JS reference)."""
    parts = []

    # 1. HTTP Method in lowercase
    parts.append(method.lower())

    # 2. Path (URL decoded)
    parts.append(unquote(path))

    # 3. Host + x-api-* headers sorted alphabetically, joined by &
    header_parts = [f"host:{host}"]
    sorted_headers = {}
    for name, value in (x_api_headers or {}).items():
        lower_name = str(name).lower()
        if lower_name.startswith("x-api-"):
            sorted_headers[lower_name] = str(value)
    for k in sorted(sorted_headers.keys()):
        header_parts.append(f"{k}:{sorted_headers[k]}")
    parts.append("&".join(header_parts))

    # 4. Query params (if any)
    if query_params:
        sorted_params = sorted(query_params.items(), key=lambda x: str(x[0]))
        qparts = []
        for k, v in sorted_params:
            qparts.append(f"{quote(unquote(str(k)), safe='')}={quote(unquote(str(v or '')), safe='')}")
        parts.append("&".join(qparts))

    # 5. Body (sort only top-level keys)
    if body is not None and len(body) > 0:
        sorted_body = _sort_body_top_level(body)
        body_json = json.dumps(sorted_body, ensure_ascii=False, separators=(",", ":")).replace("\\/", "/")
        parts.append(body_json)
    else:
        parts.append("")

    return "\n".join(parts)


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
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding

    if not host:
        host = os.getenv("FINIK_HOST", "api.acquiring.averspay.kg").strip('"\' ')
    if not api_key:
        api_key = os.getenv("FINIK_API_KEY", "").strip('"\' ')
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

    signature = private_key.sign(
        canonical_string.encode("utf-8"),
        padding.PKCS1v15(),
        hashes.SHA256(),
    )
    return base64.b64encode(signature).decode("utf-8")


def verify_webhook(
    http_method: str,
    path: str | list[str],
    timestamp: str,
    signature_b64: str,
    body: dict,
    host: str | list[str],
    x_api_headers: dict | None = None,
    query_params: dict | None = None,
    provider_public_key_path: str = "",
) -> bool:
    """
    Verify an incoming webhook signature from Finik using the official provider public key.
    Handles proxy headers (X-Forwarded-Host) and URL routing safely.
    """
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding

    try:
        sig_clean = signature_b64.strip()
        signature_bytes = base64.b64decode(sig_clean)
    except Exception as e:
        logger.error(f"Failed to decode base64 signature: {e}")
        return False

    # Load provider public key strictly from environment variable or configured storage file
    key_bytes: bytes | None = None

    env_pub_key = os.getenv("FINIK_PROVIDER_PUBLIC_KEY", "").strip()
    if env_pub_key and "BEGIN PUBLIC KEY" in env_pub_key:
        key_bytes = env_pub_key.encode("utf-8")
    else:
        if not provider_public_key_path:
            provider_public_key_path = os.getenv(
                "FINIK_PROVIDER_PUBLIC_KEY_PATH",
                str(Path(__file__).resolve().parent.parent.parent / "storage" / "finik_provider_public.pem"),
            )

        if provider_public_key_path and Path(provider_public_key_path).exists():
            try:
                with open(provider_public_key_path, "rb") as f:
                    content = f.read().strip()
                    if content:
                        key_bytes = content
            except Exception as e:
                logger.error(f"Could not read Finik provider public key file {provider_public_key_path}: {e}")
                return False
        else:
            logger.error(f"Finik provider public key file not found: {provider_public_key_path}")
            return False

    if not key_bytes:
        logger.error("No valid Finik provider public key available for verification.")
        return False

    try:
        public_key = serialization.load_pem_public_key(key_bytes)
    except Exception as e:
        logger.error(f"Invalid Finik provider public key format: {e}")
        return False

    # Normalize candidate hosts
    candidate_hosts: list[str] = []
    if isinstance(host, list):
        for h in host:
            if h and h not in candidate_hosts:
                candidate_hosts.append(h)
    elif host:
        candidate_hosts.append(host)

    # Normalize candidate paths
    candidate_paths: list[str] = []
    if isinstance(path, list):
        for p in path:
            if p and p not in candidate_paths:
                candidate_paths.append(p)
    elif path:
        candidate_paths.append(path)

    # Ensure x_api_headers has timestamp
    headers_dict = dict(x_api_headers or {})
    if timestamp:
        headers_dict["x-api-timestamp"] = str(timestamp)

    # Try matching signature with candidate hosts and paths
    for p in candidate_paths:
        for h in candidate_hosts:
            canonical_string = _create_canonical_string(
                method=http_method,
                path=p,
                host=h,
                x_api_headers=headers_dict,
                query_params=query_params,
                body=body,
            )
            try:
                public_key.verify(
                    signature_bytes,
                    canonical_string.encode("utf-8"),
                    padding.PKCS1v15(),
                    hashes.SHA256(),
                )
                logger.info(f"Finik webhook signature verified successfully (host={h}, path={p})")
                return True
            except Exception:
                continue

    logger.warning(
        f"Finik webhook signature verification failed for candidate hosts: {candidate_hosts}, paths: {candidate_paths}"
    )
    return False
