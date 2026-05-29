# Optional: Cloudflare Worker verification hook (future)

This repo currently runs as a static site (no server/backend). If you later want a lightweight “verification” step for **Manufacturer** onboarding without building a full backend, you can add a Cloudflare Worker that:

- Accepts manufacturer profile details (shop name, GST, phone, address)
- Sends an email to your admin inbox for manual verification (or logs to a sheet)
- Returns a simple reference ID to show the user

## Proposed API

### `POST /api/verify-manufacturer`

**Request**

```json
{
  "shopName": "WoodenMax Fabrication",
  "gstNumber": "27ABCDE1234F1Z5",
  "phone": "9876543210",
  "address": "Street, Area, City",
  "deviceId": "optional-client-generated-id",
  "appVersion": "optional"
}
```

**Response**

```json
{
  "ok": true,
  "referenceId": "WMV-2026-000123",
  "message": "Submitted for verification"
}
```

## Worker implementation notes

- **Auth**: keep it simple at first (rate-limit + basic bot checks). If needed later, add Turnstile.
- **Email**: use a Worker email provider (e.g. MailChannels) or forward to a webhook endpoint you control.
- **Storage** (optional): store requests in KV/D1 with timestamp and `referenceId`.
- **UI**: show “Submitted” state and the `referenceId`. You can still keep the current local-only unlock for now, and use verification only as a “send email” helper.

## Why this is optional

The current shipped role gating is **local-only** by design. Anyone can install PWA without terms; this worker would only be for your internal workflow (verification notifications), not for hard access enforcement.

