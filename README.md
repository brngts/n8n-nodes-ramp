# n8n-nodes-ramp-api

This is an n8n community node for [Ramp](https://ramp.com), the corporate card, bill pay and spend management platform. It adds two nodes:

- **Ramp**: work with transactions, bills, vendors, purchase orders, cards, funds, users and more.
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

| Resource | Operations |
| --- | --- |
| Bill | Archive, Create, Get, Get Many, Hold, Release Hold, Update |
| Card | Get, Get Many (physical or virtual); Suspend, Terminate, Unsuspend, Update (physical) |
| Department | Create, Get, Get Many, Update |
| Entity | Get, Get Many |
| Fund | Get, Get Many, Suspend, Terminate, Unsuspend, Update |
| Purchase Order | Archive, Create, Get, Get Many, Update |
| Receipt | Get, Get Many |
| Reimbursement | Get, Get Many |
| Transaction | Get, Get Many, Set Memo, Split |
| User | Deactivate, Get, Get Invite Status, Get Many, Invite, Reactivate, Update |
| Vendor | Create, Delete, Get, Get Many, Update |

Every Get Many supports Return All, following Ramp's `page.next` links, plus the filters Ramp offers for that list (dates, entity, sync status, approval status and so on).

Bills, vendors, entities, departments, users, funds, cards and purchase orders can be picked from a searchable list or entered by ID.

Nested structures, such as bill and purchase order line items, transaction splits, payment details or fund restrictions, go in a JSON field using the names from the [Ramp API reference](https://docs.ramp.com/developer-api/v1/introduction). Form fields win over the same key in the JSON.

The node does not move money: there are no operations to pay bills, create payments or issue cards with funds.

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

The tests check every operation against Ramp's OpenAPI spec: each URL and method must exist, and each query and body parameter the node sends must be one the endpoint accepts. When Ramp ships API changes, refresh the spec fixture and the trigger's event list with:

```bash
npm run sync:openapi
```

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Ramp Developer API](https://docs.ramp.com/developer-api/v1/introduction)
- [Ramp webhooks](https://docs.ramp.com/developer-api/v1/webhooks)

## License

[MIT](LICENSE.md)
