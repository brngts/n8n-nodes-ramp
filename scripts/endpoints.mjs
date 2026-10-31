/**
 * Which Ramp endpoint becomes which node operation, for every endpoint the
 * hand-written resources in nodes/Ramp/resources do not already cover.
 * `npm run generate` turns this list plus Ramp's OpenAPI spec into
 * nodes/Ramp/resources/generated/*.ts.
 *
 * Each entry: [method, path (without /developer/v1), resource, operation name].
 * The operation value is the camelCased name, with "Get Many" as "getAll".
 */

/** Resources that exist only as generated code, with their display name. */
export const GENERATED_RESOURCES = {
	accountingConnection: 'Accounting Connection',
	accountingField: 'Accounting Field',
	accountingFieldOption: 'Accounting Field Option',
	accountingSync: 'Accounting Sync',
	accountingVendor: 'Accounting Vendor',
	aiSpend: 'AI Spend',
	approval: 'Approval',
	auditLog: 'Audit Log',
	bankAccount: 'Bank Account',
	banking: 'Banking',
	blankCanvasApproval: 'Blank Canvas Approval',
	business: 'Business',
	cashback: 'Cashback',
	comment: 'Comment',
	customFormResponse: 'Custom Form Response',
	customTable: 'Custom Table',
	draftBill: 'Draft Bill',
	financingApplication: 'Financing Application',
	glAccount: 'GL Account',
	inventoryItemField: 'Inventory Item Field',
	itemReceipt: 'Item Receipt',
	location: 'Location',
	matrixTable: 'Matrix Table',
	merchant: 'Merchant',
	nativeTable: 'Native Table',
	payment: 'Payment',
	rampOnlyField: 'Ramp-Only Field',
	receiptEmailOptOut: 'Receipt Email Opt-Out',
	repayment: 'Repayment',
	spendProgram: 'Spend Program',
	spendRequest: 'Spend Request',
	statement: 'Statement',
	taxCode: 'Tax Code',
	taxRate: 'Tax Rate',
	transfer: 'Transfer',
	trip: 'Trip',
	unifiedRequest: 'Unified Request',
	vendorAgreement: 'Vendor Agreement',
	vendorCredit: 'Vendor Credit',
	webhook: 'Webhook',
};

/** Endpoints left out on purpose, with the reason. The tests check that nothing else is missing. */
export const EXCLUDED_ENDPOINTS = {
	'POST /token': 'Token issuance is handled by the credential',
	'POST /token/revoke': 'Token handling belongs to the credential',
	'GET /accounting/connection': 'Deprecated by Ramp in favour of GET /accounting/connection/{connection_id}',
	'POST /vault/cards': 'Deprecated duplicate of POST /cards/vault',
	'GET /vault/cards/{card_id}': 'Deprecated duplicate of GET /cards/vault/{card_id}',
};

/** Path parameters that pick a record with a searchable list, by generated parameter name. */
export const LIST_SEARCH = {
	bill: 'getBills',
	card: 'getCards',
	department: 'getDepartments',
	entity: 'getEntities',
	fund: 'getFunds',
	purchaseOrder: 'getPurchaseOrders',
	user: 'getUsers',
	vendor: 'getVendors',
};

export const ENDPOINTS = [
	// Accounting connection
	['GET', '/accounting/all-connections', 'accountingConnection', 'Get Many'],
	['POST', '/accounting/connection', 'accountingConnection', 'Register'],
	['DELETE', '/accounting/connection', 'accountingConnection', 'Disconnect'],
	['GET', '/accounting/connection/{connection_id}', 'accountingConnection', 'Get'],
	['PATCH', '/accounting/connection/{connection_id}', 'accountingConnection', 'Update'],
	['POST', '/accounting/connection/{connection_id}/reactivate', 'accountingConnection', 'Reactivate'],
	['POST', '/accounting/connection/{connection_id}/ready-to-migrate', 'accountingConnection', 'Mark Ready to Migrate'],

	// Accounting sync
	['POST', '/accounting/codings', 'accountingSync', 'Set Coding'],
	['POST', '/accounting/ready-to-sync', 'accountingSync', 'Mark Ready to Sync'],
	['POST', '/accounting/syncs', 'accountingSync', 'Report Sync Status'],
	['POST', '/accounting/entities', 'accountingSync', 'Upload Entities'],

	// GL accounts
	['GET', '/accounting/accounts', 'glAccount', 'Get Many'],
	['POST', '/accounting/accounts', 'glAccount', 'Upload'],
	['DELETE', '/accounting/accounts/{gl_account_id}', 'glAccount', 'Delete'],
	['GET', '/accounting/accounts/{gl_account_id}', 'glAccount', 'Get'],
	['PATCH', '/accounting/accounts/{gl_account_id}', 'glAccount', 'Update'],

	// Accounting fields and options
	['GET', '/accounting/fields', 'accountingField', 'Get Many'],
	['POST', '/accounting/fields', 'accountingField', 'Create'],
	['DELETE', '/accounting/fields/{field_id}', 'accountingField', 'Delete'],
	['GET', '/accounting/fields/{field_id}', 'accountingField', 'Get'],
	['PATCH', '/accounting/fields/{field_id}', 'accountingField', 'Update'],
	['GET', '/accounting/field-options', 'accountingFieldOption', 'Get Many'],
	['POST', '/accounting/field-options', 'accountingFieldOption', 'Upload'],
	['DELETE', '/accounting/field-options/{field_option_id}', 'accountingFieldOption', 'Delete'],
	['GET', '/accounting/field-options/{field_option_id}', 'accountingFieldOption', 'Get'],
	['PATCH', '/accounting/field-options/{field_option_id}', 'accountingFieldOption', 'Update'],
	['PUT', '/accounting/field-options/{field_option_id}', 'accountingFieldOption', 'Replace'],
	['GET', '/accounting/field-option-filter-rules', 'accountingFieldOption', 'Get Many Filter Rules'],
	['POST', '/accounting/field-option-filter-rules', 'accountingFieldOption', 'Create Filter Rules'],
	['DELETE', '/accounting/field-option-filter-rules', 'accountingFieldOption', 'Delete Filter Rules'],

	// Ramp-only fields
	['GET', '/accounting/ramp-fields', 'rampOnlyField', 'Get Many'],
	['POST', '/accounting/ramp-fields', 'rampOnlyField', 'Create'],
	['DELETE', '/accounting/ramp-fields/{field_id}', 'rampOnlyField', 'Delete'],
	['GET', '/accounting/ramp-fields/{field_id}', 'rampOnlyField', 'Get'],
	['PATCH', '/accounting/ramp-fields/{field_id}', 'rampOnlyField', 'Update'],
	['POST', '/accounting/ramp-field-options', 'rampOnlyField', 'Upload Options'],
	['DELETE', '/accounting/ramp-field-options/{field_option_id}', 'rampOnlyField', 'Delete Option'],
	['PATCH', '/accounting/ramp-field-options/{field_option_id}', 'rampOnlyField', 'Update Option'],

	// Accounting vendors (the ERP vendor list, not bill pay vendors)
	['GET', '/accounting/vendors', 'accountingVendor', 'Get Many'],
	['POST', '/accounting/vendors', 'accountingVendor', 'Upload'],
	['DELETE', '/accounting/vendors/{vendor_id}', 'accountingVendor', 'Delete'],
	['GET', '/accounting/vendors/{vendor_id}', 'accountingVendor', 'Get'],
	['PATCH', '/accounting/vendors/{vendor_id}', 'accountingVendor', 'Update'],

	// Tax codes and rates
	['GET', '/accounting/tax/code', 'taxCode', 'Get Field'],
	['POST', '/accounting/tax/code', 'taxCode', 'Create Field'],
	['PATCH', '/accounting/tax/code', 'taxCode', 'Update Field'],
	['DELETE', '/accounting/tax/code', 'taxCode', 'Delete Field'],
	['GET', '/accounting/tax/code/options', 'taxCode', 'Get Many'],
	['POST', '/accounting/tax/code/options', 'taxCode', 'Upload'],
	['DELETE', '/accounting/tax/code/options/{option_id}', 'taxCode', 'Delete'],
	['PATCH', '/accounting/tax/code/options/{option_id}', 'taxCode', 'Update'],
	['GET', '/accounting/tax/rates', 'taxRate', 'Get Many'],
	['POST', '/accounting/tax/rates', 'taxRate', 'Upload'],
	['DELETE', '/accounting/tax/rates/{tax_rate_id}', 'taxRate', 'Delete'],
	['PATCH', '/accounting/tax/rates/{tax_rate_id}', 'taxRate', 'Update'],

	// Inventory item field
	['GET', '/accounting/inventory-item', 'inventoryItemField', 'Get Field'],
	['POST', '/accounting/inventory-item', 'inventoryItemField', 'Create Field'],
	['PATCH', '/accounting/inventory-item', 'inventoryItemField', 'Update Field'],
	['DELETE', '/accounting/inventory-item', 'inventoryItemField', 'Delete Field'],
	['GET', '/accounting/inventory-item/options', 'inventoryItemField', 'Get Many'],
	['POST', '/accounting/inventory-item/options', 'inventoryItemField', 'Upload'],
	['DELETE', '/accounting/inventory-item/options/{option_id}', 'inventoryItemField', 'Delete'],
	['PATCH', '/accounting/inventory-item/options/{option_id}', 'inventoryItemField', 'Update'],

	// AI spend
	['GET', '/ai-spend/api-keys', 'aiSpend', 'Get Many API Keys'],
	['GET', '/ai-spend/settings', 'aiSpend', 'Get Settings'],
	['PUT', '/ai-spend/settings', 'aiSpend', 'Replace Settings'],
	['DELETE', '/ai-spend/settings', 'aiSpend', 'Reset Settings'],
	['GET', '/ai-spend/tagging-settings', 'aiSpend', 'Get Tagging Settings'],
	['PUT', '/ai-spend/tagging-settings', 'aiSpend', 'Replace Tagging Settings'],
	['GET', '/ai-spend/team', 'aiSpend', 'Get Team Spend'],
	['GET', '/ai-spend/usage', 'aiSpend', 'Get Usage'],

	// Approvals
	['GET', '/approvals', 'approval', 'Get Many'],
	['POST', '/approvals/{entity_type}/{entity_id}/add-step', 'approval', 'Add Approver'],
	['POST', '/blank-canvas-approvals/documents', 'blankCanvasApproval', 'Upload Document'],
	['POST', '/blank-canvas-approvals/{approval_trigger_instance_id}', 'blankCanvasApproval', 'Decide'],
	['PATCH', '/blank-canvas-approvals/{approval_trigger_instance_id}/metadata', 'blankCanvasApproval', 'Update Metadata'],

	// Business, banking and statements
	['GET', '/audit-logs/events', 'auditLog', 'Get Many'],
	['GET', '/business', 'business', 'Get'],
	['GET', '/business/balance', 'business', 'Get Balance'],
	['GET', '/bank-accounts', 'bankAccount', 'Get Many'],
	['GET', '/bank-accounts/{bank_account_id}', 'bankAccount', 'Get'],
	['GET', '/banking/accounts', 'banking', 'Get Many Accounts'],
	['GET', '/banking/accounts/{account_id}/balance-history', 'banking', 'Get Balance History'],
	['GET', '/banking/syncable-transactions', 'banking', 'Get Many Syncable Transactions'],
	['GET', '/statements', 'statement', 'Get Many'],
	['GET', '/statements/{statement_id}', 'statement', 'Get'],
	['GET', '/billing/statements', 'statement', 'Get Many Billing Statements'],
	['GET', '/cashbacks', 'cashback', 'Get Many'],
	['GET', '/cashbacks/{cashback_id}', 'cashback', 'Get'],
	['GET', '/applications', 'financingApplication', 'Get'],
	['POST', '/applications', 'financingApplication', 'Create'],

	// Bills
	['POST', '/bills/{bill_id}/associations', 'bill', 'Associate'],
	['DELETE', '/bills/{bill_id}/associations/{associated_bill_id}', 'bill', 'Remove Association'],
	['POST', '/bills/{bill_id}/attachments', 'bill', 'Upload Attachment'],
	['GET', '/bills/{bill_id}/remittance-receipt', 'bill', 'Download Remittance Receipt'],
	['GET', '/bills/drafts', 'draftBill', 'Get Many'],
	['POST', '/bills/drafts', 'draftBill', 'Create'],
	['GET', '/bills/drafts/{draft_bill_id}', 'draftBill', 'Get'],
	['PATCH', '/bills/drafts/{draft_bill_id}', 'draftBill', 'Update'],
	['POST', '/bills/drafts/{draft_bill_id}/attachments', 'draftBill', 'Upload Attachment'],
	['POST', '/bills/drafts/{draft_bill_id}/submit', 'draftBill', 'Submit'],

	// Cards
	['POST', '/cards/physical', 'card', 'Create Physical'],
	['POST', '/cards/vault', 'card', 'Create Virtual With Details'],
	['GET', '/cards/vault/{card_id}', 'card', 'Get Sensitive Details'],
	['POST', '/embedded/cards/{card_id}/embed', 'card', 'Create Embed Token'],

	// Comments and custom forms
	['GET', '/comments/{object_type}/{object_id}', 'comment', 'Get Many'],
	['POST', '/comments/{object_type}/{object_id}', 'comment', 'Create'],
	['GET', '/custom-form/collections/responses/{custom_form_collection_response_id}', 'customFormResponse', 'Get'],

	// Custom records
	['GET', '/custom-records/custom-tables', 'customTable', 'Get Many'],
	['POST', '/custom-records/configure/custom-tables', 'customTable', 'Create'],
	['GET', '/custom-records/custom-tables/{custom_table_name}/columns', 'customTable', 'Get Many Columns'],
	['POST', '/custom-records/configure/custom-tables/{custom_table_name}/columns', 'customTable', 'Create Column'],
	['PATCH', '/custom-records/configure/custom-tables/{custom_table_name}/columns/{column_name}', 'customTable', 'Rename Column'],
	['GET', '/custom-records/custom-tables/{custom_table_name}/rows', 'customTable', 'Get Many Rows'],
	['PUT', '/custom-records/custom-tables/{custom_table_name}/rows', 'customTable', 'Set Rows'],
	['DELETE', '/custom-records/custom-tables/{custom_table_name}/rows', 'customTable', 'Delete Rows'],
	['PATCH', '/custom-records/custom-tables/{custom_table_name}/rows/{row_id}', 'customTable', 'Change Row Key'],
	['POST', '/custom-records/custom-tables/{table_name}/rows/-/append', 'customTable', 'Append Cells'],
	['POST', '/custom-records/custom-tables/{table_name}/rows/-/remove', 'customTable', 'Remove Cells'],
	['GET', '/custom-records/matrix-tables', 'matrixTable', 'Get Many'],
	['POST', '/custom-records/matrix-tables', 'matrixTable', 'Create'],
	['POST', '/custom-records/matrix-tables/{table_name}/rename', 'matrixTable', 'Rename'],
	['POST', '/custom-records/matrix-tables/{table_name}/columns', 'matrixTable', 'Add Result Column'],
	['PATCH', '/custom-records/matrix-tables/{table_name}/columns/{column_name}', 'matrixTable', 'Rename Column'],
	['POST', '/custom-records/matrix-tables/{table_name}/list-rows', 'matrixTable', 'Get Many Rows'],
	['PUT', '/custom-records/matrix-tables/{table_name}/rows', 'matrixTable', 'Upsert Rows'],
	['DELETE', '/custom-records/matrix-tables/{table_name}/rows/{row_id}', 'matrixTable', 'Delete Row'],
	['POST', '/custom-records/matrix-tables/{table_name}/rows/-/append', 'matrixTable', 'Append Cells'],
	['POST', '/custom-records/matrix-tables/{table_name}/rows/-/remove', 'matrixTable', 'Remove Cells'],
	['GET', '/custom-records/native-tables', 'nativeTable', 'Get Many'],
	['POST', '/custom-records/configure/native-tables', 'nativeTable', 'Extend'],
	['GET', '/custom-records/native-tables/{native_table_name}/columns', 'nativeTable', 'Get Many Columns'],
	['POST', '/custom-records/configure/native-tables/{native_table_name}/columns', 'nativeTable', 'Create Column'],
	['PATCH', '/custom-records/configure/native-tables/{native_table_name}/columns/{column_name}', 'nativeTable', 'Rename Column'],
	['GET', '/custom-records/native-tables/{native_table_name}/rows', 'nativeTable', 'Get Many Rows'],
	['PUT', '/custom-records/native-tables/{native_table_name}/rows', 'nativeTable', 'Set Rows'],
	['POST', '/custom-records/native-tables/{native_table_name}/rows/-/append', 'nativeTable', 'Append Cells'],
	['POST', '/custom-records/native-tables/{native_table_name}/rows/-/remove', 'nativeTable', 'Remove Cells'],

	// Funds
	['POST', '/funds', 'fund', 'Create'],
	['POST', '/funds/{fund_id}/members', 'fund', 'Add Members'],
	['DELETE', '/funds/{fund_id}/members', 'fund', 'Remove Members'],
	['POST', '/funds/{fund_id}/members/{user_id}/suspension', 'fund', 'Suspend Member'],
	['DELETE', '/funds/{fund_id}/members/{user_id}/suspension', 'fund', 'Unsuspend Member'],

	// Item receipts and locations
	['GET', '/item-receipts', 'itemReceipt', 'Get Many'],
	['POST', '/item-receipts', 'itemReceipt', 'Create'],
	['DELETE', '/item-receipts/{item_receipt_id}', 'itemReceipt', 'Delete'],
	['GET', '/item-receipts/{item_receipt_id}', 'itemReceipt', 'Get'],
	['GET', '/locations', 'location', 'Get Many'],
	['POST', '/locations', 'location', 'Create'],
	['GET', '/locations/{location_id}', 'location', 'Get'],
	['PATCH', '/locations/{location_id}', 'location', 'Update'],

	// Merchants
	['GET', '/merchants', 'merchant', 'Get Many'],

	// Payments
	['GET', '/payments', 'payment', 'Get Many'],
	['POST', '/payments', 'payment', 'Create'],
	['GET', '/payments/{payment_id}', 'payment', 'Get'],
	['PATCH', '/payments/{payment_id}', 'payment', 'Update'],
	['DELETE', '/payments/{payment_id}', 'payment', 'Cancel'],
	['POST', '/payments/{payment_id}/retry', 'payment', 'Retry'],
	['GET', '/payments/{payment_id}/remittance-receipt', 'payment', 'Download Remittance Receipt'],
	['POST', '/payments/check-preview', 'payment', 'Preview Check'],

	// Purchase orders
	['POST', '/purchase-orders/{purchase_order_id}/line-items', 'purchaseOrder', 'Add Line Items'],
	['PATCH', '/purchase-orders/{purchase_order_id}/line-items/{line_item_id}', 'purchaseOrder', 'Update Line Item'],
	['DELETE', '/purchase-orders/{purchase_order_id}/line-items/{line_item_id}', 'purchaseOrder', 'Delete Line Item'],

	// Receipts and reimbursements
	['POST', '/receipts', 'receipt', 'Upload'],
	['GET', '/receipt-integrations/opt-out', 'receiptEmailOptOut', 'Get Many'],
	['POST', '/receipt-integrations/opt-out', 'receiptEmailOptOut', 'Add'],
	['DELETE', '/receipt-integrations/opt-out/{mailbox_opted_out_email_uuid}', 'receiptEmailOptOut', 'Remove'],
	['POST', '/reimbursements/mileage', 'reimbursement', 'Create Mileage'],
	['POST', '/reimbursements/submit-receipt', 'reimbursement', 'Upload Receipt'],
	['GET', '/repayments', 'repayment', 'Get Many'],

	// Spend programs and requests
	['GET', '/spend-programs', 'spendProgram', 'Get Many'],
	['POST', '/spend-programs', 'spendProgram', 'Create'],
	['GET', '/spend-programs/{spend_program_id}', 'spendProgram', 'Get'],
	['GET', '/spend-programs/{spend_program_id}/workflow-nodes', 'spendProgram', 'Get Workflow Nodes'],
	['POST', '/spend-requests/draft-via-ocr', 'spendRequest', 'Create Draft From Document'],
	['GET', '/unified-requests', 'unifiedRequest', 'Get Many'],
	['POST', '/unified-requests', 'unifiedRequest', 'Create'],
	['GET', '/unified-requests/{unified_request_id}', 'unifiedRequest', 'Get'],
	['PATCH', '/unified-requests/{unified_request_id}', 'unifiedRequest', 'Update'],
	['DELETE', '/unified-requests/{unified_request_id}', 'unifiedRequest', 'Delete'],
	['POST', '/unified-requests/{unified_request_id}/submit', 'unifiedRequest', 'Submit'],
	['GET', '/unified-requests/{unified_request_id}/attachments', 'unifiedRequest', 'Get Many Attachments'],
	['POST', '/unified-requests/{unified_request_id}/attachments', 'unifiedRequest', 'Upload Attachment'],

	// Transactions
	['GET', '/memos', 'transaction', 'Get Many Memos'],
	['GET', '/memos/{transaction_id}', 'transaction', 'Get Memo'],

	// Transfers and trips
	['GET', '/transfers', 'transfer', 'Get Many'],
	['GET', '/transfers/{transfer_id}', 'transfer', 'Get'],
	['GET', '/trips', 'trip', 'Get Many'],
	['GET', '/trips/{trip_id}', 'trip', 'Get'],

	// Users
	['POST', '/users/{user_id}/invite', 'user', 'Manage Invite'],
	['GET', '/roles', 'user', 'Get Many Roles'],

	// Vendors
	['POST', '/vendors/{vendor_id}/hold', 'vendor', 'Hold'],
	['POST', '/vendors/{vendor_id}/release', 'vendor', 'Release Hold'],
	['GET', '/vendors/{vendor_id}/children', 'vendor', 'Get Many Children'],
	['GET', '/vendors/{vendor_id}/payment-methods', 'vendor', 'Get Payment Methods'],
	['GET', '/vendors/{vendor_id}/contacts', 'vendor', 'Get Many Contacts'],
	['POST', '/vendors/{vendor_id}/contacts', 'vendor', 'Create Contact'],
	['GET', '/vendors/{vendor_id}/contacts/{vendor_contact_id}', 'vendor', 'Get Contact'],
	['GET', '/vendors/{vendor_id}/accounts', 'vendor', 'Get Many Bank Accounts'],
	['GET', '/vendors/{vendor_id}/accounts/{bank_account_id}', 'vendor', 'Get Bank Account'],
	['POST', '/vendors/{vendor_id}/accounts/{bank_account_id}/archive', 'vendor', 'Archive Bank Account'],
	['POST', '/vendors/{vendor_id}/update-bank-accounts', 'vendor', 'Add Bank Account'],
	['GET', '/vendors/credits', 'vendorCredit', 'Get Many'],
	['GET', '/vendors/credits/{vendor_credit_id}', 'vendorCredit', 'Get'],
	['GET', '/vendors/{vendor_id}/credits', 'vendorCredit', 'Get Many for Vendor'],
	['POST', '/vendors/agreements', 'vendorAgreement', 'Get Many'],
	['POST', '/vendors/{vendor_id}/agreements', 'vendorAgreement', 'Create'],
	['GET', '/vendors/agreements/{agreement_id}', 'vendorAgreement', 'Get'],
	['PATCH', '/vendors/agreements/{agreement_id}', 'vendorAgreement', 'Update'],
	['DELETE', '/vendors/agreements/{agreement_id}', 'vendorAgreement', 'Delete'],
	['POST', '/vendors/agreements/{agreement_id}/documents', 'vendorAgreement', 'Upload Documents'],
	['POST', '/vendors/agreements/{agreement_id}/link', 'vendorAgreement', 'Link'],
	['DELETE', '/vendors/agreements/{agreement_id}/unlink', 'vendorAgreement', 'Unlink'],
	['POST', '/vendors/agreements/{agreement_id}/link-spend-request', 'vendorAgreement', 'Link Spend Request'],

	// Webhooks
	['GET', '/webhooks', 'webhook', 'Get Many'],
	['POST', '/webhooks', 'webhook', 'Create'],
	['GET', '/webhooks/{webhook_id}', 'webhook', 'Get'],
	['DELETE', '/webhooks/{webhook_id}', 'webhook', 'Delete'],
	['POST', '/webhooks/{webhook_id}/verify', 'webhook', 'Verify'],
	['POST', '/webhooks/mock-webhook-event', 'webhook', 'Send Test Event'],
];
