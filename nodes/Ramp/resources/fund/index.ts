import type { INodeProperties } from 'n8n-workflow';
import {
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
import { fundGeneratedOperations, fundGeneratedProperties } from '../generated/fund';

const RESOURCE = 'fund';

const show = (operations: string[]) => ({ show: { resource: [RESOURCE], operation: operations } });

export const fundDescription: INodeProperties[] = [
	operationSelector(
		RESOURCE,
		[
			...fundGeneratedOperations,
			operation({
				name: 'Get',
				value: 'get',
				action: 'Get a fund',
				description: 'Get a fund (spend limit) with its balance, members, cards and restrictions',
				method: 'GET',
				url: '=/funds/{{$parameter.fund}}',
			}),
			operation({
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many funds',
				description: 'List funds (spend limits)',
				method: 'GET',
				url: '/funds',
				output: 'list',
			}),
			operation({
				name: 'Suspend',
				value: 'suspend',
				action: 'Suspend a fund',
				description: 'Block spend on a fund and its cards until it is unsuspended',
				method: 'POST',
				url: '=/funds/{{$parameter.fund}}/suspension',
			}),
			operation({
				name: 'Terminate',
				value: 'terminate',
				action: 'Terminate a fund',
				description: 'Permanently close a fund. This cannot be undone.',
				method: 'DELETE',
				url: '=/funds/{{$parameter.fund}}',
			}),
			operation({
				name: 'Unsuspend',
				value: 'unsuspend',
				action: 'Unsuspend a fund',
				description: 'Allow spend on a suspended fund again',
				method: 'DELETE',
				url: '=/funds/{{$parameter.fund}}/suspension',
				output: 'success',
			}),
			operation({
				name: 'Update',
				value: 'update',
				action: 'Update a fund',
				description: 'Rename a fund, link it to a spend program or change its restrictions',
				method: 'PATCH',
				url: '=/funds/{{$parameter.fund}}',
			}),
		],
		'getAll',
	),
	recordLocator({
		name: 'fund',
		displayName: 'Fund',
		searchListMethod: 'getFunds',
		searchable: true,
		displayOptions: show(['get', 'suspend', 'terminate', 'unsuspend', 'update']),
	}),

	// Update
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: show(['update']),
		options: [
			bodyOption({ displayName: 'Display Name', name: 'displayName', type: 'string', default: '' }, 'display_name'),
			bodyOption(
				{
					displayName: 'Shareable',
					name: 'isShareable',
					type: 'boolean',
					default: true,
					description: 'Whether the fund can have several members',
				},
				'is_shareable',
			),
			bodyOption(
				{
					displayName: 'Exempt From Policy Agent',
					name: 'isExemptFromPolicyAgent',
					type: 'boolean',
					default: false,
					description: "Whether the fund's spend skips Ramp's policy agent review",
				},
				'is_exempt_from_policy_agent',
			),
			bodyOption(
				{
					displayName: 'Spend Program ID',
					name: 'spendProgramId',
					type: 'string',
					default: '',
					description: 'Spend program to link the fund to',
				},
				'spend_program_id',
			),
		].sort(byDisplayName),
	},
	jsonBodyProperty(
		show(['update']),
		'Other body fields as JSON, such as spending_restrictions (merged into the current ones), permitted_spend_types or accounting_rules (both replace the current ones). Limit amounts are in the smallest currency unit (50000 is 500.00). Field names follow the Ramp API reference.',
		'{"spending_restrictions": {"limit": {"amount": 50000, "currency_code": "USD"}, "interval": "MONTHLY"}}',
	),

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
			dateQueryOption('Created After', 'createdAfter', 'created_after', 'Only funds created after this time'),
			dateQueryOption('Created Before', 'createdBefore', 'created_before', 'Only funds created before this time'),
			queryOption({ displayName: 'Display Name', name: 'displayName', type: 'string', default: '' }, 'display_name'),
			queryOption({ displayName: 'Entity ID', name: 'entityId', type: 'string', default: '' }, 'entity_id'),
			queryOption({ displayName: 'User ID', name: 'userId', type: 'string', default: '', description: 'Only funds this user owns or belongs to' }, 'user_id'),
			queryOption({ displayName: 'Card ID', name: 'cardId', type: 'string', default: '', description: 'Only funds linked to this card' }, 'card_id'),
			queryOption({ displayName: 'Spend Program ID', name: 'spendProgramId', type: 'string', default: '' }, 'spend_program_id'),
			queryOption(
				{
					displayName: 'Terminated Only',
					name: 'isTerminated',
					type: 'boolean',
					default: true,
					description: 'Whether to only return terminated funds',
				},
				'is_terminated',
			),
			listQueryOption(
				{
					displayName: 'Member Roles',
					name: 'memberRoles',
					type: 'multiOptions',
					options: [
						{ name: 'Co-Owner', value: 'COOWNER' },
						{ name: 'Member', value: 'MEMBER' },
						{ name: 'Owner', value: 'OWNER' },
					],
					default: [],
					description: 'With User ID, only funds where that user has one of these roles',
				},
				'member_roles',
			),
		].sort(byDisplayName),
	},
	...fundGeneratedProperties,
];
