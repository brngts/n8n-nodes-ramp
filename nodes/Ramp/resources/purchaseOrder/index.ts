import type { INodeProperties } from 'n8n-workflow';
import {
	bodyField,
	bodyLocator,
	bodyOption,
	byDisplayName,
	dateQueryOption,
	jsonBodyProperty,
	paginationProperties,
	queryOption,
	recordLocator,
} from '../../shared/descriptions';
import { operation, operationSelector } from '../../shared/operations';
import { setJsonArrayBodyProperty } from '../../shared/preSend';

const RESOURCE = 'purchaseOrder';

const show = (operations: string[]) => ({ show: { resource: [RESOURCE], operation: operations } });

/** Fields Create and Update share. */
const sharedBodyOptions = (): INodeProperties[] => [
	bodyOption({ displayName: 'Memo', name: 'memo', type: 'string', default: '' }, 'memo'),
	bodyOption({ displayName: 'Name', name: 'name', type: 'string', default: '' }, 'name'),
	bodyOption(
		{
			displayName: 'Owner ID',
			name: 'ownerId',
			type: 'string',
			default: '',
			description: 'User who owns the purchase order. Defaults to the creator of the Ramp developer app.',
		},
		'owner_id',
	),
	bodyOption(
		{
			displayName: 'Spend End Date',
			name: 'spendEndDate',
			type: 'string',
			default: '',
			placeholder: 'e.g. 2027-03-31',
			description: 'Date spend against the purchase order ends (YYYY-MM-DD)',
		},
		'spend_end_date',
	),
	bodyOption(
		{
			displayName: 'Spend Start Date',
			name: 'spendStartDate',
			type: 'string',
			default: '',
			placeholder: 'e.g. 2026-11-01',
			description: 'Date spend against the purchase order starts (YYYY-MM-DD)',
		},
		'spend_start_date',
	),
];

export const purchaseOrderDescription: INodeProperties[] = [
	{
		displayName: 'Purchase order endpoints need the Ramp Plus plan.',
		name: 'planNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { resource: [RESOURCE] } },
	},
	operationSelector(
		RESOURCE,
		[
			operation({
				name: 'Archive',
				value: 'archive',
				action: 'Archive a purchase order',
				description: 'Archive a purchase order',
				method: 'POST',
				url: '=/purchase-orders/{{$parameter.purchaseOrder}}/archive',
				output: 'success',
			}),
			operation({
				name: 'Create',
				value: 'create',
				action: 'Create a purchase order',
				description: 'Create a purchase order',
				method: 'POST',
				url: '/purchase-orders',
			}),
			operation({
				name: 'Get',
				value: 'get',
				action: 'Get a purchase order',
				description: 'Get a purchase order with its line items and linked bills',
				method: 'GET',
				url: '=/purchase-orders/{{$parameter.purchaseOrder}}',
			}),
			operation({
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many purchase orders',
				description: 'List purchase orders',
				method: 'GET',
				url: '/purchase-orders',
				output: 'list',
			}),
			operation({
				name: 'Update',
				value: 'update',
				action: 'Update a purchase order',
				description: 'Update an approved purchase order',
				method: 'PATCH',
				url: '=/purchase-orders/{{$parameter.purchaseOrder}}',
			}),
		],
		'getAll',
	),
	recordLocator({
		name: 'purchaseOrder',
		displayName: 'Purchase Order',
		searchListMethod: 'getPurchaseOrders',
		searchable: false,
		displayOptions: show(['archive', 'get', 'update']),
	}),

	// Archive
	{
		displayName: 'Options',
		name: 'archiveOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: show(['archive']),
		options: [
			bodyOption({ displayName: 'Reason', name: 'archivedReason', type: 'string', default: '' }, 'archived_reason'),
		],
	},

	// Create
	bodyLocator(
		recordLocator({
			name: 'entity',
			displayName: 'Entity',
			searchListMethod: 'getEntities',
			searchable: true,
			displayOptions: show(['create']),
			description: 'The business entity the purchase order belongs to',
		}),
		'entity_id',
	),
	bodyField(
		{
			displayName: 'Currency',
			name: 'currency',
			type: 'string',
			default: 'USD',
			required: true,
			placeholder: 'e.g. EUR',
			description: 'Three-letter ISO 4217 currency code',
		},
		show(['create']),
	),
	bodyField(
		{
			displayName: 'Three-Way Match',
			name: 'threeWayMatchEnabled',
			type: 'boolean',
			default: false,
			required: true,
			description: 'Whether bills against this purchase order must be matched to an item receipt before payment',
		},
		show(['create']),
		'three_way_match_enabled',
	),
	{
		displayName: 'Line Items (JSON)',
		name: 'lineItems',
		type: 'json',
		default: '[{"description": "", "unit_price": "0.00", "unit_quantity": 1}]',
		required: true,
		placeholder: '[{"description": "Annual licence", "unit_price": "12000.00", "unit_quantity": 1}]',
		description:
			'Line items as a JSON array. Unit prices are decimals in the purchase order currency (12000.00, not cents). Lines can also carry accounting_field_selections, start_date, end_date and external_id.',
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
			bodyOption({ displayName: 'Vendor ID', name: 'vendorId', type: 'string', default: '' }, 'vendor_id'),
			bodyOption(
				{
					displayName: 'External ID',
					name: 'externalId',
					type: 'string',
					default: '',
					description: 'Your own unique ID for the purchase order. Use it to find the order again and avoid duplicates.',
				},
				'external_id',
			),
			bodyOption(
				{
					displayName: 'Purchase Order Number',
					name: 'purchaseOrderNumber',
					type: 'string',
					default: '',
					placeholder: 'e.g. PO-1042',
					description: 'Unique number in the format prefix-number',
				},
				'purchase_order_number',
			),
			bodyOption(
				{
					displayName: 'Net Payment Terms (Days)',
					name: 'netPaymentTerms',
					type: 'number',
					default: 30,
				},
				'net_payment_terms',
			),
			bodyOption(
				{
					displayName: 'Promise Date',
					name: 'promiseDate',
					type: 'string',
					default: '',
					placeholder: 'e.g. 2026-11-15',
					description: 'Date the vendor will deliver (YYYY-MM-DD)',
				},
				'promise_date',
			),
		].sort(byDisplayName),
	},
	jsonBodyProperty(
		show(['create']),
		'Other body fields as JSON, such as a body-level accounting_field_selections. Field names follow the Ramp API reference. Form fields win over the same key.',
		'{"accounting_field_selections": [{"field_external_id": "dept", "field_option_external_id": "200"}]}',
	),

	// Update
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: show(['update']),
		options: sharedBodyOptions().sort(byDisplayName),
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
			dateQueryOption('Created After', 'fromCreatedAt', 'from_created_at', 'Only purchase orders requested after this time'),
			dateQueryOption('Created Before', 'toCreatedAt', 'to_created_at', 'Only purchase orders requested before this time'),
			queryOption({ displayName: 'Entity ID', name: 'entityId', type: 'string', default: '' }, 'entity_id'),
			queryOption({ displayName: 'External ID', name: 'externalId', type: 'string', default: '', description: 'Exact external ID' }, 'external_id'),
			queryOption(
				{ displayName: 'Remote ID', name: 'remoteId', type: 'string', default: '', description: 'Exact ID from the accounting system' },
				'remote_id',
			),
			queryOption({ displayName: 'Spend Request ID', name: 'spendRequestId', type: 'string', default: '' }, 'spend_request_id'),
			queryOption(
				{
					displayName: 'Receipt Status',
					name: 'receiptStatus',
					type: 'options',
					options: [
						{ name: 'Fully Received', value: 'FULLY_RECEIVED' },
						{ name: 'Not Received', value: 'NOT_RECEIVED' },
						{ name: 'Over Received', value: 'OVER_RECEIVED' },
						{ name: 'Partially Received', value: 'PARTIALLY_RECEIVED' },
					],
					default: 'NOT_RECEIVED',
				},
				'receipt_status',
			),
			queryOption(
				{
					displayName: 'Creation Source',
					name: 'creationSource',
					type: 'options',
					options: [
						{ name: 'Accounting Provider', value: 'ACCOUNTING_PROVIDER' },
						{ name: 'Developer API', value: 'DEVELOPER_API' },
						{ name: 'External Import', value: 'EXTERNAL_IMPORT' },
						{ name: 'Ramp', value: 'RAMP' },
					],
					default: 'RAMP',
				},
				'creation_source',
			),
			queryOption(
				{
					displayName: 'Three-Way Match',
					name: 'threeWayMatchEnabled',
					type: 'boolean',
					default: true,
					description: 'Whether to only return purchase orders with (true) or without (false) three-way match',
				},
				'three_way_match_enabled',
			),
			queryOption(
				{
					displayName: 'Include Archived',
					name: 'includeArchived',
					type: 'boolean',
					default: true,
					description: 'Whether to include archived purchase orders',
				},
				'include_archived',
			),
		].sort(byDisplayName),
	},
];
