# Changelog

## 0.2.0

- Covers every Ramp Developer API endpoint: 275 operations across 51 resources, up from 55 operations across 11. New resources include Unified Request, Payment, Draft Bill, Vendor Agreement, Vendor Credit, the accounting resources (connections, fields, GL accounts, tax codes and rates, sync), custom records, spend programs, locations, approvals, statements, audit logs and webhooks.
- Existing resources gain the operations they were missing, such as vendor contacts, bank accounts and holds, bill attachments and associations, fund members and card creation.
- File uploads (multipart) and PDF downloads.
- A test fails when Ramp's spec has an endpoint the node neither covers nor excludes on purpose.

## 0.1.0

- Ramp node with Bill, Card, Department, Entity, Fund, Purchase Order, Receipt, Reimbursement, Transaction, User and Vendor resources.
- Ramp Trigger with automatic webhook verification and signature checks.
- Ramp OAuth2 API credential (client credentials) with a Production/Sandbox switch.
