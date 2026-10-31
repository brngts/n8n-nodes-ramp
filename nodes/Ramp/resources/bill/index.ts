import type { INodeProperties } from 'n8n-workflow';
import {
	bodyField,
	bodyLocator,
	bodyOption,
	byDisplayName,
	dateQueryOption,
	jsonBodyProperty,
	listQueryOption,
	paginationProperties,
	queryOption,
	recordLocator,
} from '../../shared/descriptions';
import { operation, operationSelector } from '../../shared/operations';
import { BILL_STATUS_SUMMARY_OPTIONS, PAYMENT_METHOD_OPTIONS } from '../../shared/options';
import { setJsonArrayBodyProperty } from '../../shared/preSend';
import { billGeneratedOperations, billGeneratedProperties } from '../generated/bill';

const RESOURCE = 'bill';

const show = (operations: string[]) => ({ show: { resource: [RESOURCE], operation: operations } });

const billLocator = (operations: string[]) =>
	recordLocator({
		name: 'bill',
		displayName: 'Bill',
		searchListMethod: 'getBills',
		searchable: true,
		displayOptions: show(operations),
	});

/** Fields Create and Update share. Update also takes the ones Create requires. */
const sharedBodyOptions = (): INodeProperties[] => [
	bodyOption(
		{
			displayName: 'Memo',
			name: 'memo',
			type: 'string',
			default: '',
			description: 'Internal memo on the bill',
		},
		'memo',
	),
	bodyOption(
		{
			displayName: 'Vendor Memo',
			name: 'vendorMemo',
			type: 'string',
			default: '',
			description: 'Memo sent to the vendor with the payment',
		},
		'vendor_memo',
	),
	bodyOption(
		{
			displayName: 'Payment Method',
			name: 'paymentMethod',
			type: 'options',
			options: PAYMENT_METHOD_OPTIONS,
			default: 'ACH',
		},
		'payment_method',
	),
	bodyOption(
		{
			displayName: 'Payment Date',
			name: 'paymentDate',
			type: 'string',
			default: '',
			placeholder: 'e.g. 2026-11-30',
			description: 'For non-card payment methods, the date the payment is scheduled to start (YYYY-MM-DD)',
		},
		'payment_date',
	),
	bodyOption(
		{
			displayName: 'Posting Date',
			name: 'postingDate',
			type: 'string',
			default: '',
			placeholder: 'e.g. 2026-10-31',
			description: 'The date the bill is posted to the accounting system (YYYY-MM-DD)',
		},
		'posting_date',
	),
	bodyOption(
		{
			displayName: 'Remote ID',
			name: 'remoteId',
			type: 'string',
			default: '',
			description: 'The ID of the bill in your own system. Requires an accounting connection.',
		},
		'remote_id',
	),
	bodyOption(
		{
			displayName: 'Vendor Contact ID',
			name: 'vendorContactId',
			type: 'string',
			default: '',
			description: 'Contact of the vendor to send the payment notice to',
		},
		'vendor_contact_id',
	),
];

export const billDescription: INodeProperties[] = [
	operationSelector(
		RESOURCE,
		[
			...billGeneratedOperations,
			operation({
				name: 'Archive',
				value: 'archive',
				action: 'Archive a bill',
				description:
					'Archive (delete) a bill. Cancels in-flight payments where possible. Paid bills cannot be archived.',
				method: 'DELETE',
				url: '=/bills/{{$parameter.bill}}',
				output: 'success',
			}),
			operation({
				name: 'Create',
				value: 'create',
				action: 'Create a bill',
				description: 'Create a bill for a vendor. It goes through the bill approval policy like any other.',
				method: 'POST',
				url: '/bills',
			}),
			operation({
				name: 'Get',
				value: 'get',
				action: 'Get a bill',
				description: 'Get a bill with its line items, payment and sync status',
				method: 'GET',
				url: '=/bills/{{$parameter.bill}}',
			}),
			operation({
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many bills',
				description: 'List bills',
				method: 'GET',
				url: '/bills',
				output: 'list',
			}),
			operation({
				name: 'Hold',
				value: 'hold',
				action: 'Put a bill on hold',
				description: 'Block every payment rail on a bill and unschedule its payments',
				method: 'POST',
				url: '=/bills/{{$parameter.bill}}/hold',
			}),
			operation({
				name: 'Release Hold',
				value: 'release',
				action: 'Release a bill hold',
				description: 'Release a hold so the bill can be paid again',
				method: 'POST',
				url: '=/bills/{{$parameter.bill}}/release',
			}),
			operation({
				name: 'Update',
				value: 'update',
				action: 'Update a bill',
				description: 'Update an approved bill',
				method: 'PATCH',
				url: '=/bills/{{$parameter.bill}}',
			}),
		],
		'getAll',
	),
	billLocator(['archive', 'get', 'hold', 'release', 'update']),

	// Create
	bodyLocator(
		recordLocator({
			name: 'vendor',
			displayName: 'Vendor',
			searchListMethod: 'getVendors',
			searchable: true,
			displayOptions: show(['create']),
		}),
		'vendor_id',
	),
	bodyLocator(
		recordLocator({
			name: 'entity',
			displayName: 'Entity',
			searchListMethod: 'getEntities',
			searchable: true,
			displayOptions: show(['create']),
			description: 'The business entity the bill belongs to',
		}),
		'entity_id',
	),
	bodyField(
		{
			displayName: 'Invoice Number',
			name: 'invoiceNumber',
			type: 'string',
			default: '',
			required: true,
		},
		show(['create']),
		'invoice_number',
	),
	bodyField(
		{
			displayName: 'Invoice Currency',
			name: 'invoiceCurrency',
			type: 'string',
			default: 'USD',
			required: true,
			placeholder: 'e.g. EUR',
			description: 'Three-letter ISO 4217 currency code of the invoice',
		},
		show(['create']),
		'invoice_currency',
	),
	bodyField(
		{
			displayName: 'Issued At',
			name: 'issuedAt',
			type: 'string',
			default: '',
			required: true,
			placeholder: 'e.g. 2026-10-31',
			description: 'Issue date on the invoice (YYYY-MM-DD)',
		},
		show(['create']),
		'issued_at',
	),
	bodyField(
		{
			displayName: 'Due At',
			name: 'dueAt',
			type: 'string',
			default: '',
			required: true,
			placeholder: 'e.g. 2026-11-30',
			description: 'Due date of the invoice (YYYY-MM-DD)',
		},
		show(['create']),
		'due_at',
	),
	{
		displayName: 'Line Items (JSON)',
		name: 'lineItems',
		type: 'json',
		default: '[{"amount": "0.00", "memo": ""}]',
		required: true,
		placeholder:
			'[{"amount": "1250.00", "memo": "October licences", "accounting_field_selections": [{"field_external_id": "gl_account", "field_option_external_id": "6800"}]}]',
		description:
			'Bill line items as a JSON array. Amounts are decimals in the invoice currency (1250.00, not cents). Code each line with accounting_field_selections using the external IDs from your ERP.',
		displayOptions: show(['create']),
		routing: {
			send: {
				preSend: [setJsonArrayBodyProperty('lineItems', 'line_items', 'Line Items (JSON)')],
			},
		},
	},
	{
		displayName: 'Additional Fields',
		name: 'createFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: show(['create']),
		options: [
			...sharedBodyOptions(),
			bodyOption(
				{
					displayName: 'Enable Accounting Sync',
					name: 'enableAccountingSync',
					type: 'boolean',
					default: true,
					description: 'Whether the bill syncs to the ERP. Turn off for bills already booked there.',
				},
				'enable_accounting_sync',
			),
			bodyOption(
				{
					displayName: 'Use Default Payment Method',
					name: 'useDefaultPaymentMethod',
					type: 'boolean',
					default: true,
					description: "Whether to pay with the vendor's default payment method instead of setting one here",
				},
				'use_default_payment_method',
			),
			bodyOption(
				{
					displayName: 'Use Default Vendor Contact',
					name: 'useDefaultVendorContact',
					type: 'boolean',
					default: true,
					description: "Whether to send the payment notice to the vendor's default contact",
				},
				'use_default_vendor_contact',
			),
		].sort(byDisplayName),
	},
	jsonBodyProperty(
		show(['create']),
		'Other body fields as JSON, such as payment_details, purchase_order_ids, inventory_line_items or a body-level accounting_field_selections. Field names follow the Ramp API reference. Form fields win over the same key.',
		'{"purchase_order_ids": ["..."]}',
	),

	// Update
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: show(['update']),
		options: [
			...sharedBodyOptions(),
			bodyOption({ displayName: 'Due At', name: 'dueAt', type: 'string', default: '', placeholder: 'e.g. 2026-11-30' }, 'due_at'),
			bodyOption({ displayName: 'Entity ID', name: 'entityId', type: 'string', default: '' }, 'entity_id'),
			bodyOption({ displayName: 'Invoice Number', name: 'invoiceNumber', type: 'string', default: '' }, 'invoice_number'),
			bodyOption({ displayName: 'Issued At', name: 'issuedAt', type: 'string', default: '', placeholder: 'e.g. 2026-10-31' }, 'issued_at'),
			bodyOption({ displayName: 'Vendor ID', name: 'vendorId', type: 'string', default: '' }, 'vendor_id'),
		].sort(byDisplayName),
	},
	jsonBodyProperty(
		show(['update']),
		'Other body fields as JSON, such as line_items or accounting_field_selections. Sending line_items replaces all existing lines. Form fields win over the same key.',
		'{"line_items": [{"amount": "1250.00", "memo": "October licences"}]}',
	),

	// Hold
	{
		displayName: 'Options',
		name: 'holdOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: show(['hold']),
		options: [
			bodyOption({ displayName: 'Reason', name: 'reason', type: 'string', default: '' }, 'reason'),
		],
	},

	// Get Many
	...paginationProperties(show(['getAll'])),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: show(['getAll']),
		options: [
			dateQueryOption('Created After', 'fromCreatedAt', 'from_created_at', 'Only bills created on or after this time'),
			dateQueryOption('Created Before', 'toCreatedAt', 'to_created_at', 'Only bills created on or before this time'),
			dateQueryOption('Due After', 'fromDueDate', 'from_due_date', 'Only bills due on or after this time'),
			dateQueryOption('Due Before', 'toDueDate', 'to_due_date', 'Only bills due on or before this time'),
			dateQueryOption('Issued After', 'fromIssuedDate', 'from_issued_date', 'Only bills issued on or after this time'),
			dateQueryOption('Issued Before', 'toIssuedDate', 'to_issued_date', 'Only bills issued on or before this time'),
			dateQueryOption('Paid After', 'fromPaidAt', 'from_paid_at', 'Only bills paid on or after this time'),
			dateQueryOption('Paid Before', 'toPaidAt', 'to_paid_at', 'Only bills paid on or before this time'),
			queryOption(
				{
					displayName: 'Approval Status',
					name: 'approvalStatus',
					type: 'options',
					options: [
						{ name: 'Approved', value: 'APPROVED' },
						{ name: 'Initialized', value: 'INITIALIZED' },
						{ name: 'Pending', value: 'PENDING' },
						{ name: 'Rejected', value: 'REJECTED' },
						{ name: 'Terminated', value: 'TERMINATED' },
					],
					default: 'APPROVED',
				},
				'approval_status',
			),
			queryOption(
				{
					displayName: 'Payment Status',
					name: 'paymentStatus',
					type: 'options',
					options: [
						{ name: 'Open', value: 'OPEN' },
						{ name: 'Paid', value: 'PAID' },
					],
					default: 'OPEN',
				},
				'payment_status',
			),
			queryOption(
				{
					displayName: 'Payment Method',
					name: 'paymentMethod',
					type: 'options',
					options: PAYMENT_METHOD_OPTIONS,
					default: 'ACH',
				},
				'payment_method',
			),
			queryOption(
				{
					displayName: 'Sync Status',
					name: 'syncStatus',
					type: 'options',
					options: [
						{ name: 'Bill and Payment Synced', value: 'BILL_AND_PAYMENT_SYNCED' },
						{ name: 'Bill Synced', value: 'BILL_SYNCED' },
						{ name: 'Not Synced', value: 'NOT_SYNCED' },
					],
					default: 'NOT_SYNCED',
				},
				'sync_status',
			),
			queryOption(
				{
					displayName: 'Sync Ready',
					name: 'syncReady',
					type: 'boolean',
					default: true,
					description: 'Whether to only return bills ready to sync to the ERP',
				},
				'sync_ready',
			),
			queryOption(
				{
					displayName: 'Archived',
					name: 'isArchived',
					type: 'boolean',
					default: true,
					description: 'Whether to return archived (deleted) bills instead of active ones',
				},
				'is_archived',
			),
			queryOption(
				{
					displayName: 'Payment Details Missing',
					name: 'paymentDetailsMissing',
					type: 'boolean',
					default: true,
					description: 'Whether to only return bills missing payment details, such as a vendor bank account',
				},
				'payment_details_missing',
			),
			queryOption({ displayName: 'Entity ID', name: 'entityId', type: 'string', default: '' }, 'entity_id'),
			queryOption({ displayName: 'Vendor ID', name: 'vendorId', type: 'string', default: '' }, 'vendor_id'),
			queryOption(
				{ displayName: 'Purchase Order ID', name: 'purchaseOrderId', type: 'string', default: '' },
				'purchase_order_id',
			),
			queryOption(
				{
					displayName: 'Invoice Number',
					name: 'invoiceNumber',
					type: 'string',
					default: '',
					description: 'Exact invoice number',
				},
				'invoice_number',
			),
			queryOption(
				{
					displayName: 'Remote ID',
					name: 'remoteId',
					type: 'string',
					default: '',
					description: 'Exact ID of the bill in your own system',
				},
				'remote_id',
			),
			queryOption(
				{
					displayName: 'Min Amount',
					name: 'minAmount',
					type: 'number',
					default: 0,
					typeOptions: { numberPrecision: 2 },
				},
				'min_amount',
			),
			queryOption(
				{
					displayName: 'Max Amount',
					name: 'maxAmount',
					type: 'number',
					default: 0,
					typeOptions: { numberPrecision: 2 },
				},
				'max_amount',
			),
			listQueryOption(
				{
					displayName: 'Status Summaries',
					name: 'statusSummaries',
					type: 'multiOptions',
					options: BILL_STATUS_SUMMARY_OPTIONS,
					default: [],
					description: 'Only bills with one of these statuses',
				},
				'status_summaries',
			),
		].sort(byDisplayName),
	},
	...billGeneratedProperties,
];
