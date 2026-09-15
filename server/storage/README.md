# Finik RSA Keys

This directory contains RSA keys used for signing requests to Finik (AversPay QR) and verifying incoming webhooks:

- `finik_private.pem` — Private RSA key used by your server to sign outgoing requests (`/v1/payment`)
- `finik_public.pem` — Public RSA key paired with your private key (registered with Finik / AversPay)
- `finik_provider_public.pem` — Finik's public RSA key used by your server to verify incoming webhook signatures

### Generating / Updating Keys

To generate a new key pair or re-generate test keys, run:
```bash
python generate_keys.py
```

### Production Setup

1. Provide your `finik_public.pem` to your Finik (AversPay) representative.
2. Obtain Finik's public RSA key and save it as `finik_provider_public.pem` in this directory.
3. Configure your merchant credentials in `.env`:
   ```env
   FINIK_API_KEY=your_api_key
   FINIK_ACCOUNT_ID=your_account_id
   FINIK_HOST=api.acquiring.averspay.kg
   FINIK_BASE_URL=https://api.acquiring.averspay.kg
   FINIK_MERCHANT_CATEGORY_CODE=0742
   FINIK_QR_NAME="Vibe Workflow"
   FINIK_KURS_DOLLARA=87.5
   ```
