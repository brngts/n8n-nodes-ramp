import type { INodeProperties } from 'n8n-workflow';
import {
	bodyOption,
	byDisplayName,
	paginationProperties,
	queryOption,
	recordLocator,
} from '../../shared/descriptions';
import { operation, operationSelector } from '../../shared/operations';

const RESOURCE = 'card';

const show = (operations: string[]) => ({ show: { resource: [RESOURCE], operation: operations } });

export const cardDescription: INodeProperties[] = [
	operationSelector(
		RESOURCE,
		[
			operation({
				name: 'Get',
				value: 'get',
				action: 'Get a card',
				description: 'Get a physical or virtual card. Card numbers are never returned.',
				method: 'GET',
				url: '=/cards/{{$parameter.cardType}}/{{$parameter.card}}',
			}),
			operation({
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many cards',
				description: 'List physical or virtual cards',
				method: 'GET',
				url: '=/cards/{{$parameter.cardType}}',
				output: 'list',
			}),
			operation({
				name: 'Suspend',
				value: 'suspend',
				action: 'Suspend a card',
				description: 'Lock a physical card. The suspension can be lifted with Unsuspend.',
				method: 'POST',
				url: '=/cards/physical/{{$parameter.card}}/suspension',
			}),
			operation({
				name: 'Terminate',
				value: 'terminate',
				action: 'Terminate a card',
				description: 'Permanently terminate a physical card. This cannot be undone.',
				method: 'DELETE',
				url: '=/cards/physical/{{$parameter.card}}',
				output: 'success',
			}),
			operation({
				name: 'Unsuspend',
				value: 'unsuspend',
				action: 'Unsuspend a card',
				description: 'Unlock a suspended physical card',
				method: 'DELETE',
				url: '=/cards/physical/{{$parameter.card}}/suspension',
				output: 'success',
			}),
			operation({
				name: 'Update',
				value: 'update',
				action: 'Update a card',
				description: 'Rename a physical card or move it to another fund',
				method: 'PATCH',
				url: '=/cards/physical/{{$parameter.card}}',
			}),
		],
		'getAll',
	),
	{
		displayName: 'Card Type',
		name: 'cardType',
		type: 'options',
		options: [
			{ name: 'Physical', value: 'physical' },
			{ name: 'Virtual', value: 'virtual' },
		],
		default: 'physical',
		displayOptions: show(['get', 'getAll']),
	},
	{
		displayName:
			'Ramp only offers these actions for physical cards. Control a virtual card through its fund instead (Fund > Suspend or Terminate).',
		name: 'physicalNotice',
		type: 'notice',
		default: '',
		displayOptions: show(['suspend', 'terminate', 'unsuspend', 'update']),
	},
	recordLocator({
		name: 'card',
		displayName: 'Card',
		searchListMethod: 'getCards',
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
					displayName: 'Fund ID',
					name: 'fundId',
					type: 'string',
					default: '',
					description: 'Fund the card spends from. Cannot be combined with automatic routing.',
				},
				'fund_id',
			),
			bodyOption(
				{
					displayName: 'Automatic Routing',
					name: 'automaticRoutingEnabled',
					type: 'boolean',
					default: true,
					description:
						"Whether Ramp routes each purchase to the best matching fund. Only for the cardholder's primary card.",
				},
				'automatic_routing_enabled',
			),
		].sort(byDisplayName),
	},

	// Get Many
	...paginationProperties(show(['getAll'])),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: [RESOURCE], operation: ['getAll'], cardType: ['physical'] } },
		options: [
			queryOption({ displayName: 'User ID', name: 'userId', type: 'string', default: '', description: 'Only cards of this cardholder' }, 'user_id'),
			queryOption({ displayName: 'Display Name', name: 'displayName', type: 'string', default: '' }, 'display_name'),
			queryOption(
				{
					displayName: 'Activated Only',
					name: 'includeActivatedOnly',
					type: 'boolean',
					default: true,
					description: 'Whether to only return activated cards. Ramp defaults to true.',
				},
				'include_activated_only',
			),
			queryOption(
				{
					displayName: 'Terminated Only',
					name: 'includeTerminatedOnly',
					type: 'boolean',
					default: true,
					description: 'Whether to only return terminated cards',
				},
				'include_terminated_only',
			),
		].sort(byDisplayName),
	},
	{
		displayName: 'Filters',
		name: 'virtualFilters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: [RESOURCE], operation: ['getAll'], cardType: ['virtual'] } },
		options: [
			queryOption({ displayName: 'User ID', name: 'userId', type: 'string', default: '', description: 'Only cards of this cardholder' }, 'user_id'),
			queryOption({ displayName: 'Entity ID', name: 'entityId', type: 'string', default: '' }, 'entity_id'),
			queryOption(
				{
					displayName: 'Terminated Only',
					name: 'isTerminated',
					type: 'boolean',
					default: true,
					description: 'Whether to only return terminated cards',
				},
				'is_terminated',
			),
		].sort(byDisplayName),
	},
];
