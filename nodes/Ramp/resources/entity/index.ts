import type { INodeProperties } from 'n8n-workflow';
import { byDisplayName, paginationProperties, queryOption, recordLocator } from '../../shared/descriptions';
import { operation, operationSelector } from '../../shared/operations';

const RESOURCE = 'entity';

const show = (operations: string[]) => ({ show: { resource: [RESOURCE], operation: operations } });

export const entityDescription: INodeProperties[] = [
	operationSelector(
		RESOURCE,
		[
			operation({
				name: 'Get',
				value: 'get',
				action: 'Get an entity',
				description: 'Get a business entity',
				method: 'GET',
				url: '=/entities/{{$parameter.entity}}',
			}),
			operation({
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many entities',
				description: 'List the business entities, for example to scope other lists by entity',
				method: 'GET',
				url: '/entities',
				output: 'list',
			}),
		],
		'getAll',
	),
	recordLocator({
		name: 'entity',
		displayName: 'Entity',
		searchListMethod: 'getEntities',
		searchable: true,
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
			queryOption({ displayName: 'Name', name: 'entityName', type: 'string', default: '' }, 'entity_name'),
			queryOption(
				{
					displayName: 'Currency',
					name: 'currency',
					type: 'string',
					default: '',
					placeholder: 'e.g. EUR',
					description: 'Only entities with this three-letter currency code',
				},
				'currency',
			),
			queryOption(
				{
					displayName: 'Primary Only',
					name: 'isPrimary',
					type: 'boolean',
					default: true,
					description: 'Whether to only return the primary entity (true) or only the others (false)',
				},
				'is_primary',
			),
			queryOption(
				{
					displayName: 'Hide Inactive',
					name: 'hideInactive',
					type: 'boolean',
					default: true,
					description: 'Whether to leave out inactive entities',
				},
				'hide_inactive',
			),
		].sort(byDisplayName),
	},
];
