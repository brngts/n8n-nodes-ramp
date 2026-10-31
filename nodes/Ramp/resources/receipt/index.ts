import type { INodeProperties } from 'n8n-workflow';
import {
	byDisplayName,
	dateQueryOption,
	paginationProperties,
	queryOption,
	recordLocator,
} from '../../shared/descriptions';
import { operation, operationSelector } from '../../shared/operations';
import { receiptGeneratedOperations, receiptGeneratedProperties } from '../generated/receipt';

const RESOURCE = 'receipt';

const show = (operations: string[]) => ({ show: { resource: [RESOURCE], operation: operations } });

const includeOcrData = () =>
	queryOption(
		{
			displayName: 'Include OCR Data',
			name: 'includeOcrData',
			type: 'boolean',
			default: true,
			description:
				'Whether to include the data Ramp read from the receipt, such as currency, tax amount and line items',
		},
		'include_ocr_data',
	);

export const receiptDescription: INodeProperties[] = [
	operationSelector(
		RESOURCE,
		[
			...receiptGeneratedOperations,
			operation({
				name: 'Get',
				value: 'get',
				action: 'Get a receipt',
				description: 'Get a receipt with a download link to its file',
				method: 'GET',
				url: '=/receipts/{{$parameter.receipt}}',
			}),
			operation({
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many receipts',
				description: 'List receipts, for example to archive the files',
				method: 'GET',
				url: '/receipts',
				output: 'list',
			}),
		],
		'getAll',
	),
	recordLocator({
		name: 'receipt',
		displayName: 'Receipt',
		displayOptions: show(['get']),
	}),

	...paginationProperties(show(['getAll'])),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: show(['getAll']),
		options: [
			dateQueryOption('Created After', 'createdAfter', 'created_after', 'Only receipts uploaded after this time'),
			dateQueryOption('Created Before', 'createdBefore', 'created_before', 'Only receipts uploaded before this time'),
			dateQueryOption('Transaction Date After', 'fromDate', 'from_date', 'Only receipts for transactions made after this time'),
			dateQueryOption('Transaction Date Before', 'toDate', 'to_date', 'Only receipts for transactions made before this time'),
			queryOption({ displayName: 'Transaction ID', name: 'transactionId', type: 'string', default: '' }, 'transaction_id'),
			queryOption(
				{ displayName: 'Reimbursement ID', name: 'reimbursementId', type: 'string', default: '' },
				'reimbursement_id',
			),
			includeOcrData(),
		].sort(byDisplayName),
	},
	...receiptGeneratedProperties,
];
