# n8n-nodes-ramp-api

This is an n8n community node for [Ramp](https://ramp.com), the corporate card, bill pay and spend management platform. It adds two nodes:

- **Ramp**: the full Ramp Developer API, from cards, transactions and bills to payments, procurement requests, accounting fields and custom records.
- **Ramp Trigger**: start a workflow from Ramp webhook events, such as a cleared transaction or a paid bill.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

[Installation](#installation) · [Credentials](#credentials) · [Operations](#operations) · [Trigger](#trigger) · [Things to know](#things-to-know) · [Development](#development)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation and install `n8n-nodes-ramp-api`.

## Credentials

The node uses OAuth 2.0 client credentials, the grant Ramp recommends for internal integrations.

1. In Ramp, an admin opens **Company > Developer** and creates an app.
2. Under **Grant types**, add **Client Credentials**.
3. Under **Scopes**, allow the scopes you need (see below).
4. Copy the client ID and secret.

In n8n, create a **Ramp OAuth2 API** credential:

| Field | Value |
| --- | --- |
| Environment | **Production** for app.ramp.com apps, **Sandbox** for demo.ramp.com apps |
| Client ID / Client Secret | From the Ramp app |
| Scope | Space-separated scopes. The default asks for every scope the node uses |

Every scope in the credential must also be allowed on the Ramp app, otherwise Ramp refuses the token. For a read-only setup, remove the `:write` scopes. Keep `business:read`, which the credential test uses. Sandbox and production need separate Ramp apps.

Ramp access tokens expire after ten days. n8n fetches a new one automatically when Ramp answers 401.

The credential also works with the built-in **HTTP Request** node (Authentication: Predefined Credential Type > Ramp OAuth2 API) for any endpoint this node does not cover.

## Operations

The node covers the whole Ramp Developer API: 275 operations across 51 resources. The only endpoints left out are token issuance (the credential handles it) and three that Ramp has deprecated in favour of newer ones.

| Area | Resources |
| --- | --- |
| Spend | Card, Fund, Transaction, Receipt, Reimbursement, Repayment, Merchant, Spend Program, Statement, Cashback, Trip |
| Bill pay | Bill, Draft Bill, Payment, Vendor, Vendor Agreement, Vendor Credit, Transfer |
| Procurement | Unified Request, Spend Request, Purchase Order, Item Receipt, Approval, Blank Canvas Approval |
| Accounting | Accounting Connection, Accounting Sync, Accounting Field, Accounting Field Option, Ramp-Only Field, Accounting Vendor, GL Account, Tax Code, Tax Rate, Inventory Item Field |
| Custom records | Custom Table, Matrix Table, Native Table |
| Company | Business, Entity, Department, Location, User, Bank Account, Banking, Audit Log, AI Spend, Financing Application |
| Other | Comment, Custom Form Response, Receipt Email Opt-Out, Webhook |

Every Get Many supports Return All, following Ramp's `page.next` links, plus the filters Ramp offers for that list.

Bills, vendors, entities, departments, users, funds, cards and purchase orders can be picked from a searchable list or entered by ID. Other records are entered by ID.

Flat fields are form fields. Nested structures, such as line items, payment details, accounting codings or fund restrictions, go in JSON fields using the names from the [Ramp API reference](https://docs.ramp.com/developer-api/v1/introduction). Form fields win over the same key in the JSON.

Uploads (bill and draft bill attachments, receipts, reimbursement receipts, procurement attachments, vendor agreement documents, spend requests from a document) take a file from an input binary field. Remittance receipts download as binary PDF files.

Operations on the core resources (Bill, Card, Fund, Purchase Order, Transaction, User, Vendor and the rest of the first release) have hand-written forms. The others are generated from Ramp's OpenAPI spec by `npm run generate`, so they use Ramp's own field names and descriptions.

## Trigger

The Ramp Trigger creates a webhook subscription when the workflow is activated and deletes it when the workflow is deactivated.

- Pick specific events or **All Events**. The list of 48 event types comes from Ramp's API spec and webhooks guide.
- Ramp verifies a new subscription by posting a challenge to the webhook URL. The trigger answers it and activates the subscription itself.
- Every delivery is checked against the `X-Ramp-Signature` HMAC using the secret Ramp returned when the subscription was created.
- Events only carry the ID of the record that changed (`object.id`). Add a Ramp node after the trigger to load the full record.
- Ramp may deliver an event more than once and out of order. The event `id` stays the same on every retry.
- Ramp has no replay. For anything that must not be missed, pair the trigger with a scheduled Get Many that reconciles.

## Things to know

- **Amounts use different units per endpoint.** Bill and purchase order amounts are decimals (`"1250.00"`). Transaction splits and fund limits are in minor units (`125000`). The transaction Min/Max Amount filters are in US dollars.
- **Splitting a transaction clears its tax amounts.** Ramp does not keep tax data on split line items.
- **Ramp does not deduplicate vendors or bills.** Check with Get Many (vendor name or external ID, bill invoice number) before creating one.
- **The rate limit is 200 requests per 10 seconds per IP address**, shared by every workflow on the same n8n instance. A 429 can block requests for 60 seconds. Use the node's batching settings for large runs.
- **Incremental sync filters differ per list.** Reimbursements have Updated After; transactions only have Synced After (accounting syncs, not edits); bills only have Created After.
- **Payment > Create and Retry move real money.** They require an idempotency key, which the node generates per item unless you set one from your own data. Set one, so a re-run cannot pay twice.
- **Card > Create Virtual With Details and Get Sensitive Details return full card numbers and CVVs.** Ramp only grants the `cards:read_vault` scope to approved integrators. Treat the output like a password and keep it out of logs and execution data you share.
- **Each resource needs its scopes.** The credential's default scope covers the core resources. For the others, add the matching scope to the Ramp app and the credential, for example `unified_requests:read`, `payments:write`, `accounting:write` or `custom_records:read`. A missing scope shows as a 403 that names it.
- Errors show Ramp's own message, its error code and the `x-trace-id` to quote to Ramp support.
- Purchase order endpoints need the Ramp Plus plan.

## Compatibility

Built with `@n8n/node-cli` 0.54. Requires n8n 1.x or later with `n8nNodesApiVersion` 1.

## Development

```bash
npm install
npm run dev        # runs n8n with the nodes linked, rebuilding on changes
npm run lint       # n8n community node rules
npm test           # description, signature and helper tests
npm run build
```

The tests check every operation against Ramp's OpenAPI spec: each URL and method must exist, and each query and body parameter the node sends must be one the endpoint accepts. A further test fails when Ramp adds an endpoint the node does not cover yet. When Ramp ships API changes, refresh the spec fixture and the trigger's event list, then regenerate the operations:

```bash
npm run sync:openapi
npm run generate
```

New endpoints go in `scripts/endpoints.mjs` (resource and operation name), or in its excluded list with a reason.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Ramp Developer API](https://docs.ramp.com/developer-api/v1/introduction)
- [Ramp webhooks](https://docs.ramp.com/developer-api/v1/webhooks)

## License

[MIT](LICENSE.md)
