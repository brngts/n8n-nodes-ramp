import type { INodeProperties } from 'n8n-workflow';
import {
	byDisplayName,
	dateQueryOption,
	paginationProperties,
	queryOption,
	recordLocator,
} from '../../shared/descriptions';
import { operation, operationSelector } from '../../shared/operations';
import { REIMBURSEMENT_STATE_OPTIONS, SYNC_STATUS_OPTIONS } from '../../shared/options';
import { reimbursementGeneratedOperations, reimbursementGeneratedProperties } from '../generated/reimbursement';

const RESOURCE = 'reimbursement';

const show = (operations: string[]) => ({ show: { resource: [RESOURCE], operation: operations } });

export const reimbursementDescription: INodeProperties[] = [
	operationSelector(
		RESOURCE,
		[
			...reimbursementGeneratedOperations,
			operation({
				name: 'Get',
				value: 'get',
				action: 'Get a reimbursement',
				description: 'Get an employee reimbursement or repayment',
				method: 'GET',
				url: '=/reimbursements/{{$parameter.reimbursement}}',
			}),
			operation({
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many reimbursements',
				description: 'List employee reimbursements, or repayments to the business',
				method: 'GET',
				url: '/reimbursements',
				output: 'list',
			}),
		],
		'getAll',
	),
	recordLocator({
		name: 'reimbursement',
		displayName: 'Reimbursement',
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
			dateQueryOption('Created After', 'fromDate', 'from_date', 'Only reimbursements created after this time'),
			dateQueryOption('Created Before', 'toDate', 'to_date', 'Only reimbursements created before this time'),
			dateQueryOption('Submitted After', 'fromSubmittedAt', 'from_submitted_at', 'Only reimbursements submitted after this time'),
			dateQueryOption('Submitted Before', 'toSubmittedAt', 'to_submitted_at', 'Only reimbursements submitted before this time'),
			dateQueryOption(
				'Transaction Date After',
				'fromTransactionDate',
				'from_transaction_date',
				'Only reimbursements for spend after this time',
			),
			dateQueryOption(
				'Transaction Date Before',
				'toTransactionDate',
				'to_transaction_date',
				'Only reimbursements for spend before this time',
			),
			dateQueryOption(
				'Updated After',
				'updatedAfter',
				'updated_after',
				'Only reimbursements changed after this time. Use it for incremental syncs.',
			),
			dateQueryOption('Synced After', 'syncedAfter', 'synced_after', 'Only reimbursements synced to the accounting system after this time'),
			queryOption(
				{
					displayName: 'Direction',
					name: 'direction',
					type: 'options',
					options: [
						{
							name: 'Business to User',
							value: 'BUSINESS_TO_USER',
							description: 'Reimbursements paid to employees',
						},
						{
							name: 'User to Business',
							value: 'USER_TO_BUSINESS',
							description: 'Repayments from employees to the business',
						},
					],
					default: 'BUSINESS_TO_USER',
				},
				'direction',
			),
			queryOption(
				{
					displayName: 'State',
					name: 'state',
					type: 'options',
					options: REIMBURSEMENT_STATE_OPTIONS,
					default: 'APPROVED',
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
					displayName: 'Has Been Approved',
					name: 'hasBeenApproved',
					type: 'boolean',
					default: true,
					description: 'Whether to only return approved (true) or not yet approved (false) reimbursements',
				},
				'has_been_approved',
			),
			queryOption({ displayName: 'Entity ID', name: 'entityId', type: 'string', default: '' }, 'entity_id'),
			queryOption({ displayName: 'User ID', name: 'userId', type: 'string', default: '' }, 'user_id'),
			queryOption({ displayName: 'Trip ID', name: 'tripId', type: 'string', default: '' }, 'trip_id'),
		].sort(byDisplayName),
	},
	...reimbursementGeneratedProperties,
];
