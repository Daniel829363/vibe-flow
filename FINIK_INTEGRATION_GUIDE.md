# Полное руководство по интеграции платёжной системы Finik (AversPay QR)

Данное руководство содержит исчерпывающую техническую документацию, архитектурную схему, правила формирования канонической подписи RSA-SHA256, примеры кода (Python, PHP, Node.js) и инструкции по развёртыванию эквайринга **Finik** на любом проекте.

---

## 1. Архитектура и схема взаимодействия

```
┌──────────────┐         1. Создать платёж         ┌───────────────┐
│ Пользователь │ ────────────────────────────────> │  Ваш Бэкенд   │
└──────────────┘                                   └───────┬───────┘
       │                                                   │ 2. Формирует запрос и
       │                                                   │    подпись RSA-SHA256
       │                                                   ▼
       │         4. Редирект на форму оплаты       ┌───────────────┐
       │ <──────────────────────────────────────── │   Finik API   │
       │    (302 Found + заголовок Location)       └───────────────┘
       ▼
┌──────────────────────────────┐
│ Сканирует QR-код через       │
│ приложение любого банка КР   │
└──────────────┬───────────────┘
               │
               │ 5. Успешная оплата
               ▼
┌──────────────────────────────┐ 6. POST Webhook с подписью ┌───────────────┐
│          Finik API           │ ─────────────────────────> │  Ваш Бэкенд   │
└──────────────────────────────┘                            └───────┬───────┘
                                                                    │ 7. Проверка подписи
                                                                    │ 8. Начисление баланса
                                                                    │ 9. Ответ {"success": true}
                                                                    ▼
                                                            ┌───────────────┐
                                                            │ База данных   │
                                                            └───────────────┘
```

---

## 2. Ключи и доступы

### 2.1. Данные от Finik
От менеджера или в личном кабинете [Finik](https://www.finik.kg/):
- **`FINIK_API_KEY`** — Секретный токен API.
- **`FINIK_ACCOUNT_ID`** — UUID вашего мерчант-аккаунта в системе Finik.
- **`FINIK_MERCHANT_CATEGORY_CODE`** — MCC-код вашей деятельности (например, `0742`).
- **`FINIK_QR_NAME`** — Название мерчанта на экране QR-оплаты.

### 2.2. Генерация пары RSA-ключей мерчанта
Для подписи ваших исходящих запросов к API Finik сгенерируйте пару RSA 2048-бит:

```bash
# 1. Генерация приватного ключа
openssl genrsa -out finik_private.pem 2048

# 2. Извлечение публичного ключа
openssl rsa -in finik_private.pem -pubout -out finik_public.pem
```

- **`finik_private.pem`** — сохраните в надёжном хранилище на сервере (`storage/finik_private.pem`). **Никому не передавайте!**
- **`finik_public.pem`** — передайте менеджеру Finik (они привяжут его к вашему `accountId`).

### 2.3. Публичные RSA-ключи Finik для проверки вебхуков
Finik подписывает входящие вебхуки своим приватным ключом. Для проверки подписи используйте официальный публичный RSA-ключ Finik:

#### 🟢 Production (`api.acquiring.averspay.kg`):
```text
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuF/PUmhMPPidcMxhZBPb
BSGJoSphmCI+h6ru8fG8guAlcPMVlhs+ThTjw2LHABvciwtpj51ebJ4EqhlySPyT
hqSfXI6Jp5dPGJNDguxfocohaz98wvT+WAF86DEglZ8dEsfoumojFUy5sTOBdHEu
g94B4BbrJvjmBa1YIx9Azse4HFlWhzZoYPgyQpArhokeHOHIN2QFzJqeriANO+wV
aUMta2AhRVZHbfyJ36XPhGO6A5FYQWgjzkI65cxZs5LaNFmRx6pjnhjIeVKKgF99
4OoYCzhuR9QmWkPl7tL4Kd68qa/xHLz0Psnuhm0CStWOYUu3J7ZpzRK8GoEXRcr8
tQIDAQAB
-----END PUBLIC KEY-----
```

#### 🟡 Beta / Staging (`beta.api.acquiring.averspay.kg`):
```text
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwlrlKz/8gLWd1ARWGA/8
o3a3Qy8G+hPifyqiPosiTY6nCHovANMIJXk6DH4qAqqZeLu8pLGxudkPbv8dSyG7
F9PZEAryMPzjoB/9P/F6g0W46K/FHDtwTM3YIVvstbEbL19m8yddv/xCT9JPPJTb
LsSTVZq5zCqvKzpupwlGS3Q3oPyLAYe+ZUn4Bx2J1WQrBu3b08fNaR3E8pAkCK27
JqFnP0eFfa817VCtyVKcFHb5ij/D0eUP519Qr/pgn+gsoG63W4pPHN/pKwQUUiAy
uLSHqL5S2yu1dffyMcMVi9E/Q2HCTcez5OvOllgOtkNYHSv9pnrMRuws3u87+hNT
ZwIDAQAB
-----END PUBLIC KEY-----
```

---

## 3. Спецификация канонической подписи (RSA-SHA256)

Каноническая строка формируется строго из **4 или 5 строк**, объединённых символом переноса `\n`:

1. **HTTP Method**: нижний регистр (`post`, `get`).
2. **Path**: декодированный URI путь без домена (`urldecode(path)` / `unquote(path)`).
3. **Заголовки**: строка `host:<Host>` и все заголовки, начинающиеся с `x-api-` в нижнем регистре, отсортированные по алфавиту и объединённые через `&`.
4. **Query-параметры** *(если есть)*: отсортированные по ключам параметры вида `rawurlencode(k)=rawurlencode(v)`, объединённые через `&`.
5. **Тело запроса (Body)**:
   - Сортируются **только ключи верхнего уровня** (вложенные объекты и массивы не сортируются).
   - JSON формируется без экранирования слэшей `\/`, без экранирования Unicode и с компактными разделителями `(separators=(',', ':'))`.

### Пример канонической строки:
```text
post
/api/payment/finik/webhook
host:vibeflow.paitap.app&x-api-timestamp:1789994827561
{"amount":8.9,"clientId":"...","data":{...},"fields":{...},"id":"...","status":"succeeded","transactionDate":1789994826792,"transactionId":"..."}
```

---

## 4. Реализация на Python (FastAPI / Cryptography)

### 4.1. Сервис подписи и верификации (`app/utils/finik_signature.py`)

```python
import os
import json
import base64
import logging
from pathlib import Path
from urllib.parse import quote, unquote

logger = logging.getLogger(__name__)

FINIK_PROD_PUBLIC_KEY = """-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuF/PUmhMPPidcMxhZBPb
BSGJoSphmCI+h6ru8fG8guAlcPMVlhs+ThTjw2LHABvciwtpj51ebJ4EqhlySPyT
hqSfXI6Jp5dPGJNDguxfocohaz98wvT+WAF86DEglZ8dEsfoumojFUy5sTOBdHEu
g94B4BbrJvjmBa1YIx9Azse4HFlWhzZoYPgyQpArhokeHOHIN2QFzJqeriANO+wV
aUMta2AhRVZHbfyJ36XPhGO6A5FYQWgjzkI65cxZs5LaNFmRx6pjnhjIeVKKgF99
4OoYCzhuR9QmWkPl7tL4Kd68qa/xHLz0Psnuhm0CStWOYUu3J7ZpzRK8GoEXRcr8
tQIDAQAB
-----END PUBLIC KEY-----"""


def _sort_body_top_level(body: dict) -> dict:
    """Сортировка ключей только верхнего уровня."""
    return dict(sorted(body.items(), key=lambda item: str(item[0])))


def _create_canonical_string(
    method: str,
    path: str,
    host: str,
    x_api_headers: dict,
    query_params: dict | None = None,
    body: dict | None = None,
) -> str:
    parts = [method.lower(), unquote(path)]

    # Заголовки: host + x-api-*
    header_parts = [f"host:{host}"]
    sorted_headers = {}
    for name, value in (x_api_headers or {}).items():
        lower_name = str(name).lower()
        if lower_name.startswith("x-api-"):
            sorted_headers[lower_name] = str(value)
    for k in sorted(sorted_headers.keys()):
        header_parts.append(f"{k}:{sorted_headers[k]}")
    parts.append("&".join(header_parts))

    # Query параметры
    if query_params:
        sorted_params = sorted(query_params.items(), key=lambda x: str(x[0]))
        qparts = [f"{quote(unquote(str(k)), safe='')}={quote(unquote(str(v or '')), safe='')}" for k, v in sorted_params]
        parts.append("&".join(qparts))

    # Body
    if body is not None and len(body) > 0:
        sorted_body = _sort_body_top_level(body)
        body_json = json.dumps(sorted_body, ensure_ascii=False, separators=(",", ":")).replace("\\/", "/")
        parts.append(body_json)
    else:
        parts.append("")

    return "\n".join(parts)


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
    """Подпись исходящего запроса к API Finik."""
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding

    host = host or os.getenv("FINIK_HOST", "api.acquiring.averspay.kg").strip('"\' ')
    api_key = api_key or os.getenv("FINIK_API_KEY", "").strip('"\' ')
    private_key_path = private_key_path or "storage/finik_private.pem"

    x_api_headers = {"x-api-key": api_key, "x-api-timestamp": timestamp}

    canonical_string = _create_canonical_string(
        method=http_method, path=path, host=host, x_api_headers=x_api_headers, query_params=query_params, body=body
    )

    with open(private_key_path, "rb") as f:
        private_key = serialization.load_pem_private_key(f.read(), password=None)

    signature = private_key.sign(canonical_string.encode("utf-8"), padding.PKCS1v15(), hashes.SHA256())
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
    """Проверка подписи входящего вебхука от Finik."""
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding

    try:
        signature_bytes = base64.b64decode(signature_b64.strip())
    except Exception:
        return False

    key_bytes = None
    if provider_public_key_path and Path(provider_public_key_path).exists():
        with open(provider_public_key_path, "rb") as f:
            key_bytes = f.read().strip()
    if not key_bytes:
        key_bytes = FINIK_PROD_PUBLIC_KEY.encode("utf-8")

    try:
        public_key = serialization.load_pem_public_key(key_bytes)
    except Exception as e:
        logger.error(f"Invalid public key: {e}")
        return False

    candidate_hosts = [host] if isinstance(host, str) else host
    candidate_paths = [path] if isinstance(path, str) else path
    headers_dict = dict(x_api_headers or {})
    if timestamp:
        headers_dict["x-api-timestamp"] = str(timestamp)

    for p in candidate_paths:
        for h in candidate_hosts:
            canonical_string = _create_canonical_string(
                method=http_method, path=p, host=h, x_api_headers=headers_dict, query_params=query_params, body=body
            )
            try:
                public_key.verify(signature_bytes, canonical_string.encode("utf-8"), padding.PKCS1v15(), hashes.SHA256())
                return True
            except Exception:
                continue

    return False
```

---

### 4.2. Роутер платежей (`app/routers/payment_router.py`)

```python
import os
import uuid
import json
import time
import httpx
from urllib.parse import urlparse
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from app.database import get_db
from app.models.user import User
from app.models.finik_payment import FinikPayment
from app.utils.finik_signature import sign_request, verify_webhook

router = APIRouter(prefix="/api/payment", tags=["payment"])


@router.post("/finik/create")
async def create_finik_payment(amount_kgs: float, current_user: User, db: AsyncSession = Depends(get_db)):
    """Создание счёта на оплату в Finik."""
    payment_uuid = str(uuid.uuid4())
    app_url = os.getenv("APP_URL", "https://yourdomain.com").strip()
    webhook_url = f"{app_url}/api/payment/finik/webhook"

    # Сохраняем в БД со статусом PENDING
    payment = FinikPayment(
        user_id=current_user.id,
        payment_id=payment_uuid,
        amount_kgs=amount_kgs,
        status="PENDING",
    )
    db.add(payment)
    await db.commit()

    # Формируем тело запроса
    amount_normalized = int(amount_kgs) if float(amount_kgs).is_integer() else round(float(amount_kgs), 2)
    body = {
        "Amount": amount_normalized,
        "CardType": "FINIK_QR",
        "PaymentId": payment_uuid,
        "RedirectUrl": f"{app_url}/cabinet/billing",
        "Data": {
            "accountId": os.getenv("FINIK_ACCOUNT_ID"),
            "merchantCategoryCode": os.getenv("FINIK_MERCHANT_CATEGORY_CODE", "0742"),
            "name_en": os.getenv("FINIK_QR_NAME", "Payment"),
            "webhookUrl": webhook_url,
            "description": f"Payment #{payment_uuid}",
        },
    }

    timestamp = str(int(time.time() * 1000))
    host = os.getenv("FINIK_HOST", "api.acquiring.averspay.kg")
    base_url = os.getenv("FINIK_BASE_URL", "https://api.acquiring.averspay.kg")
    api_key = os.getenv("FINIK_API_KEY")

    signature = sign_request(http_method="post", path="/v1/payment", timestamp=timestamp, body=body, host=host)

    # Отправляем в Finik без следования по 302 редиректу
    async with httpx.AsyncClient(follow_redirects=False) as client:
        response = await client.post(
            f"{base_url}/v1/payment",
            content=json.dumps(body, ensure_ascii=False, separators=(",", ":")),
            headers={
                "Host": host,
                "Content-Type": "application/json",
                "x-api-key": api_key,
                "x-api-timestamp": timestamp,
                "signature": signature,
            },
            timeout=30.0,
        )

    if response.status_code in (301, 302, 303, 307, 308):
        payment_url = response.headers.get("Location")
        return {"payment_url": payment_url, "payment_id": payment_uuid}

    raise HTTPException(status_code=502, detail="Ошибка связи с Finik")


@router.post("/finik/webhook")
async def handle_finik_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Обработчик входящих Webhook от Finik."""
    signature = (request.headers.get("signature") or "").strip()
    timestamp = (request.headers.get("x-api-timestamp") or "").strip()

    if not signature or not timestamp:
        return JSONResponse({"error": "Missing signature headers"}, status_code=400)

    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)

    # Сбор хостов для защиты от подмены в Nginx/Next.js прокси
    candidate_hosts = []
    if request.headers.get("x-forwarded-host"):
        for h in request.headers.get("x-forwarded-host").split(","):
            candidate_hosts.append(h.strip().split(":")[0])
    if request.headers.get("host"):
        candidate_hosts.append(request.headers.get("host").split(":")[0])
    if os.getenv("APP_URL"):
        candidate_hosts.append(urlparse(os.getenv("APP_URL")).hostname)

    x_api_headers = {k.lower(): v for k, v in request.headers.items() if k.lower().startswith("x-api-")}
    x_api_headers["x-api-timestamp"] = timestamp

    is_valid = verify_webhook(
        http_method="post",
        path=[request.url.path, "/api/payment/finik/webhook"],
        timestamp=timestamp,
        signature_b64=signature,
        body=body,
        host=candidate_hosts,
        x_api_headers=x_api_headers,
    )

    if not is_valid:
        return JSONResponse({"error": "Invalid signature"}, status_code=401)

    # Поиск платежа по всем возможным полям ID
    fields = body.get("fields") if isinstance(body.get("fields"), dict) else {}
    possible_ids = [
        fields.get("PaymentId"),
        fields.get("paymentId"),
        body.get("paymentId"),
        body.get("PaymentId"),
        body.get("transactionId"),
        fields.get("qrTransactionId"),
    ]
    possible_ids = [str(pid).strip() for pid in possible_ids if pid]

    result = await db.execute(
        select(FinikPayment).where(
            or_(FinikPayment.payment_id.in_(possible_ids), FinikPayment.transaction_id.in_(possible_ids))
        )
    )
    payment = result.scalar_one_or_none()

    if not payment:
        return JSONResponse({"error": "Payment not found"}, status_code=404)

    status_raw = str(body.get("status") or "").lower()
    is_success = status_raw in ("succeeded", "success", "ok")

    if is_success and payment.status != "SUCCEEDED":
        payment.status = "SUCCEEDED"
        payment.transaction_id = str(body.get("transactionId", payment.transaction_id))

        # Начисление баланса пользователю
        user = await db.get(User, payment.user_id)
        if user:
            user.balance += payment.amount_kgs

        await db.commit()

    return {"success": True}
```

---

## 5. Типичные ошибки и чеклист для Production

| Проблема | Причина | Решение |
| :--- | :--- | :--- |
| **`401 Invalid signature` на вебхуке** | 1. Использован mock/dummy публичный ключ вместо официального Production ключа Finik.<br>2. Nginx/Next.js подменил `Host` на `localhost:8000`. | Убедитесь, что публичный ключ взят из раздела 2.3 и передавайте `X-Forwarded-Host` в `verify_webhook()`. |
| **Код на сервере не обновляется после `git pull`** | В Docker для Production код скопирован внутрь контейнера во время сборки (`COPY app ./app`). Обычный `docker compose restart` не обновляет файлы. | Всегда выполняйте `docker compose -f docker-compose.prod.yml up -d --build server`. |
| **400 Bad Request при запросе к `/v1/payment`** | Дробная часть суммы содержит лишние `.0` (например `89.0` вместо `89`). | Нормализуйте сумму: `int(amount)` если целое, иначе `round(float(amount), 2)`. |
| **cURL/httpx виснет или возвращает пустой ответ** | Finik возвращает `302 Found`, а клиент автоматически следует по редиректу. | Отключите автоматический редирект (`follow_redirects=False` в httpx или `CURLOPT_FOLLOWLOCATION => false` в cURL) и спарсите URL из заголовка `Location`. |

---

## 6. Тестирование

Для тестирования формирования канонической строки и подписи можно использовать следующий скрипт:

```bash
python -c "
from app.utils.finik_signature import _create_canonical_string
canonical = _create_canonical_string(
    method='POST',
    path='/api/payment/finik/webhook',
    host='yourdomain.com',
    x_api_headers={'x-api-timestamp': '1789994827561'},
    body={'amount': 100, 'status': 'succeeded'}
)
print('Canonical String:\n' + canonical)
"
```
