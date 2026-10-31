import type { INodeProperties } from 'n8n-workflow';
import {
	bodyField,
	bodyOption,
	byDisplayName,
	dateQueryOption,
	paginationProperties,
	queryOption,
	recordLocator,
} from '../../shared/descriptions';
import { operation, operationSelector } from '../../shared/operations';
import { SYNC_STATUS_OPTIONS } from '../../shared/options';
import { setJsonArrayBodyProperty } from '../../shared/preSend';

const RESOURCE = 'transaction';

const show = (operations: string[]) => ({ show: { resource: [RESOURCE], operation: operations } });

/** Ramp takes one `order_by_*=true` flag per sort order, so the chosen flag is the query parameter name. */
const sortOption: INodeProperties = {
	displayName: 'Sort',
	name: 'sort',
	type: 'options',
	options: [
		{ name: 'Amount (Ascending)', value: 'order_by_amount_asc' },
		{ name: 'Amount (Descending)', value: 'order_by_amount_desc' },
		{ name: 'Date (Ascending)', value: 'order_by_date_asc' },
		{ name: 'Date (Descending)', value: 'order_by_date_desc' },
	],
	default: 'order_by_date_desc',
	routing: {
		send: {
			type: 'query',
			property: '={{ $value }}',
			value: 'true',
		},
	},
};

export const transactionDescription: INodeProperties[] = [
	operationSelector(
		RESOURCE,
		[
			operation({
				name: 'Get',
				value: 'get',
				action: 'Get a transaction',
				description: 'Get a card transaction with its receipts, coding and approval state',
				method: 'GET',
				url: '=/transactions/{{$parameter.transaction}}',
			}),
			operation({
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many transactions',
				description: 'List card transactions. Declined ones are left out unless State is set to All.',
				method: 'GET',
				url: '/transactions',
				output: 'list',
			}),
			operation({
				name: 'Set Memo',
				value: 'setMemo',
				action: 'Set a transaction memo',
				description: 'Write the memo on a transaction',
				method: 'POST',
				url: '=/memos/{{$parameter.transaction}}',
			}),
			operation({
				name: 'Split',
				value: 'split',
				action: 'Split a transaction',
				description: 'Split a transaction into coded line items, replace an existing split, or remove it',
				method: 'PATCH',
				url: '=/transactions/{{$parameter.transaction}}',
			}),
		],
		'getAll',
	),
	recordLocator({
		name: 'transaction',
		displayName: 'Transaction',
		displayOptions: show(['get', 'setMemo', 'split']),
	}),

	// Get
	{
		displayName: 'Options',
		name: 'getOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: show(['get']),
		options: [
			queryOption(
				{
					displayName: 'Include Merchant Data',
					name: 'includeMerchantData',
					type: 'boolean',
					default: false,
					description: 'Whether to include all purchase data the merchant provided, such as line-level data',
				},
				'include_merchant_data',
			),
		],
	},

	// Set Memo
	bodyField(
		{
			displayName: 'Memo',
			name: 'memo',
			type: 'string',
			default: '',
			required: true,
			typeOptions: { rows: 2 },
		},
		show(['setMemo']),
	),
	{
		displayName: 'Options',
		name: 'memoOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: show(['setMemo']),
		options: [
			bodyOption(
				{
					displayName: 'Apply to Similar Future Transactions',
					name: 'isMemoRecurring',
					type: 'boolean',
					default: false,
					description: 'Whether Ramp should reuse this memo for similar transactions in the future',
				},
				'is_memo_recurring',
			),
		],
	},

	// Split
	{
		displayName:
			'Splitting a transaction clears its tax amounts. Ramp does not support tax data on split line items.',
		name: 'splitNotice',
		type: 'notice',
		default: '',
		displayOptions: show(['split']),
	},
	{
		displayName: 'Line Items (JSON)',
		name: 'lineItems',
		type: 'json',
		default: '[]',
		required: true,
		placeholder:
			'[{"amount": 6000, "memo": "Team A"}, {"amount": 4000, "memo": "Team B", "accounting_field_selections": [{"field_external_id": "dept", "field_option_external_id": "200"}]}]',
		description:
			'The split as a JSON array. Amounts are in minor units (5000 is 50.00) and must add up to the transaction amount. Each line can carry its own memo and accounting_field_selections. Send an empty array to remove the split.',
		displayOptions: show(['split']),
		routing: {
			send: {
				preSend: [setJsonArrayBodyProperty('lineItems', 'line_items', 'Line Items (JSON)')],
			},
		},
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
			dateQueryOption('From Date', 'fromDate', 'from_date', 'Only transactions made on or after this time'),
			dateQueryOption('To Date', 'toDate', 'to_date', 'Only transactions made before this time'),
			dateQueryOption(
				'Synced After',
				'syncedAfter',
				'synced_after',
				'Only transactions synced to the accounting system after this time. Not a general updated-after filter.',
			),
			queryOption(
				{
					displayName: 'State',
					name: 'state',
					type: 'options',
					options: [
						{ name: 'All (Including Declined)', value: 'ALL' },
						{ name: 'Cleared', value: 'CLEARED' },
						{ name: 'Completion', value: 'COMPLETION' },
						{ name: 'Declined', value: 'DECLINED' },
						{ name: 'Error', value: 'ERROR' },
						{ name: 'Pending', value: 'PENDING' },
						{ name: 'Pending Initiation', value: 'PENDING_INITIATION' },
					],
					default: 'CLEARED',
				},
				'state',
			),
			queryOption(
				{
					displayName: 'Sync Status',
					name: 'syncStatus',
					type: 'options',
					options: SYNC_STATUS_OPTIONS,
					default: 'SYNC_READY',
				},
				'sync_status',
			),
			queryOption(
				{
					displayName: 'Approval Status',
					name: 'approvalStatus',
					type: 'options',
					options: [
						{ name: 'Awaiting Employee', value: 'AWAITING_EMPLOYEE' },
						{ name: 'Awaiting Employee (Changes Requested)', value: 'AWAITING_EMPLOYEE_CHANGES_REQUESTED' },
						{ name: 'Awaiting Employee (Missing Items)', value: 'AWAITING_EMPLOYEE_MISSING_ITEMS' },
						{ name: 'Awaiting Employee (Repayment Failed)', value: 'AWAITING_EMPLOYEE_REPAYMENT_FAILED' },
						{
							name: 'Awaiting Employee (Repayment Requested)',
							value: 'AWAITING_EMPLOYEE_REPAYMENT_REQUESTED',
						},
						{ name: 'Awaiting Reviewer', value: 'AWAITING_REVIEWER' },
						{ name: 'Fully Approved', value: 'FULLY_APPROVED' },
					],
					default: 'FULLY_APPROVED',
				},
				'approval_status',
			),
			queryOption(
				{
					displayName: 'All Requirements Met and Approved',
					name: 'allRequirementsMetAndApproved',
					type: 'boolean',
					default: true,
					description:
						'Whether to only return transactions that are fully approved with every cardholder requirement, such as receipts, met',
				},
				'all_requirements_met_and_approved',
			),
			queryOption(
				{
					displayName: 'Has Been Approved',
					name: 'hasBeenApproved',
					type: 'boolean',
					default: true,
					description: 'Whether to only return approved (true) or not yet approved (false) transactions',
				},
				'has_been_approved',
			),
			queryOption(
				{
					displayName: 'Requires Memo',
					name: 'requiresMemo',
					type: 'boolean',
					default: true,
					description: 'Whether to only return transactions that need a memo but do not have one',
				},
				'requires_memo',
			),
			queryOption(
				{
					displayName: 'Entity ID',
					name: 'entityId',
					type: 'string',
					default: '',
					description: 'Only transactions of this business entity',
				},
				'entity_id',
			),
			queryOption(
				{
					displayName: 'User ID',
					name: 'userId',
					type: 'string',
					default: '',
					description: 'Only transactions of this cardholder',
				},
				'user_id',
			),
			queryOption(
				{ displayName: 'Department ID', name: 'departmentId', type: 'string', default: '' },
				'department_id',
			),
			queryOption(
				{
					displayName: 'Card ID',
					name: 'cardId',
					type: 'string',
					default: '',
					description: 'Only transactions on this physical card',
				},
				'card_id',
			),
			queryOption(
				{
					displayName: 'Fund ID',
					name: 'limitId',
					type: 'string',
					default: '',
					description: 'Only transactions charged to this fund (spend limit)',
				},
				'limit_id',
			),
			queryOption(
				{ displayName: 'Merchant ID', name: 'merchantId', type: 'string', default: '' },
				'merchant_id',
			),
			queryOption(
				{ displayName: 'Spend Program ID', name: 'spendProgramId', type: 'string', default: '' },
				'spend_program_id',
			),
			queryOption(
				{ displayName: 'Statement ID', name: 'statementId', type: 'string', default: '' },
				'statement_id',
			),
			queryOption(
				{
					displayName: 'Min Amount (USD)',
					name: 'minAmount',
					type: 'number',
					default: 0,
					description: 'Only transactions above this amount, in US dollars',
				},
				'min_amount',
			),
			queryOption(
				{
					displayName: 'Max Amount (USD)',
					name: 'maxAmount',
					type: 'number',
					default: 0,
					description: 'Only transactions below this amount, in US dollars',
				},
				'max_amount',
			),
			queryOption(
				{
					displayName: 'Include Merchant Data',
					name: 'includeMerchantData',
					type: 'boolean',
					default: false,
					description: 'Whether to include all purchase data the merchant provided',
				},
				'include_merchant_data',
			),
			sortOption,
		].sort(byDisplayName),
	},
];
