import type { INodeProperties } from 'n8n-workflow';
import { bodyField, paginationProperties, recordLocator } from '../../shared/descriptions';
import { operation, operationSelector } from '../../shared/operations';

const RESOURCE = 'department';

const show = (operations: string[]) => ({ show: { resource: [RESOURCE], operation: operations } });

export const departmentDescription: INodeProperties[] = [
	operationSelector(
		RESOURCE,
		[
			operation({
				name: 'Create',
				value: 'create',
				action: 'Create a department',
				description: 'Create a department',
				method: 'POST',
				url: '/departments',
			}),
			operation({
				name: 'Get',
				value: 'get',
				action: 'Get a department',
				description: 'Get a department',
				method: 'GET',
				url: '=/departments/{{$parameter.department}}',
			}),
			operation({
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many departments',
				description: 'List departments',
				method: 'GET',
				url: '/departments',
				output: 'list',
			}),
			operation({
				name: 'Update',
				value: 'update',
				action: 'Rename a department',
				description: 'Rename a department',
				method: 'PATCH',
				url: '=/departments/{{$parameter.department}}',
			}),
		],
		'getAll',
	),
	recordLocator({
		name: 'department',
		displayName: 'Department',
		searchListMethod: 'getDepartments',
		searchable: false,
		displayOptions: show(['get', 'update']),
	}),
	bodyField(
		{ displayName: 'Name', name: 'name', type: 'string', default: '', required: true },
		show(['create', 'update']),
	),
	...paginationProperties(show(['getAll'])),
];
