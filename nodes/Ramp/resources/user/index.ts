import type { INodeProperties } from 'n8n-workflow';
import {
	bodyField,
	bodyOption,
	byDisplayName,
	paginationProperties,
	queryOption,
	recordLocator,
} from '../../shared/descriptions';
import { operation, operationSelector } from '../../shared/operations';
import { USER_ROLE_OPTIONS } from '../../shared/options';
import { ensureIdempotencyKey } from '../../shared/preSend';
import { userGeneratedOperations, userGeneratedProperties } from '../generated/user';

const RESOURCE = 'user';

const show = (operations: string[]) => ({ show: { resource: [RESOURCE], operation: operations } });

/** Fields Invite and Update share. */
const sharedBodyOptions = (): INodeProperties[] => [
	bodyOption({ displayName: 'Department ID', name: 'departmentId', type: 'string', default: '' }, 'department_id'),
	bodyOption({ displayName: 'Direct Manager ID', name: 'directManagerId', type: 'string', default: '' }, 'direct_manager_id'),
	bodyOption(
		{
			displayName: 'Is Manager',
			name: 'isManager',
			type: 'boolean',
			default: false,
			description: 'Whether the user manages other employees',
		},
		'is_manager',
	),
	bodyOption(
		{
			displayName: 'Location ID',
			name: 'locationId',
			type: 'string',
			default: '',
			description: 'Location of the user. Locations tie users to a business entity.',
		},
		'location_id',
	),
	bodyOption(
		{
			displayName: 'Scheduled Deactivation Date',
			name: 'scheduledDeactivationDate',
			type: 'string',
			default: '',
			placeholder: 'e.g. 2026-12-31',
			description: 'Date the user is deactivated automatically (YYYY-MM-DD)',
		},
		'scheduled_deactivation_date',
	),
];

export const userDescription: INodeProperties[] = [
	operationSelector(
		RESOURCE,
		[
			...userGeneratedOperations,
			operation({
				name: 'Deactivate',
				value: 'deactivate',
				action: 'Deactivate a user',
				description: 'Stop a user from logging in, spending on cards or getting notifications',
				method: 'PATCH',
				url: '=/users/{{$parameter.user}}/deactivate',
				output: 'success',
			}),
			operation({
				name: 'Get',
				value: 'get',
				action: 'Get a user',
				description: 'Get a user',
				method: 'GET',
				url: '=/users/{{$parameter.user}}',
			}),
			operation({
				name: 'Get Invite Status',
				value: 'getInviteStatus',
				action: 'Get the status of a user invite',
				description: 'Check whether an invite sent with Invite has gone out. Invites are processed in the background.',
				method: 'GET',
				url: '=/users/deferred/status/{{$parameter.taskId}}',
			}),
			operation({
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many users',
				description: 'List users. Draft and suspended users are left out unless Status is set.',
				method: 'GET',
				url: '/users',
				output: 'list',
			}),
			operation({
				name: 'Invite',
				value: 'invite',
				action: 'Invite a user',
				description: 'Email an invite to join Ramp, or create a draft user. Returns a task ID for Get Invite Status.',
				method: 'POST',
				url: '/users/deferred',
			}),
			operation({
				name: 'Reactivate',
				value: 'reactivate',
				action: 'Reactivate a user',
				description: 'Reactivate a deactivated user',
				method: 'PATCH',
				url: '=/users/{{$parameter.user}}/reactivate',
				output: 'success',
			}),
			operation({
				name: 'Update',
				value: 'update',
				action: 'Update a user',
				description: "Change a user's name, role, department, manager or location",
				method: 'PATCH',
				url: '=/users/{{$parameter.user}}',
				output: 'success',
			}),
		],
		'getAll',
	),
	recordLocator({
		name: 'user',
		displayName: 'User',
		searchListMethod: 'getUsers',
		searchable: true,
		displayOptions: show(['deactivate', 'get', 'reactivate', 'update']),
	}),
	{
		displayName: 'Task ID',
		name: 'taskId',
		type: 'string',
		default: '',
		required: true,
		description: 'The ID the Invite operation returned',
		displayOptions: show(['getInviteStatus']),
	},

	// Invite
	bodyField({ displayName: 'Email', name: 'email', type: 'string', placeholder: 'name@email.com', default: '', required: true }, show(['invite'])),
	bodyField({ displayName: 'First Name', name: 'firstName', type: 'string', default: '', required: true }, show(['invite']), 'first_name'),
	bodyField({ displayName: 'Last Name', name: 'lastName', type: 'string', default: '', required: true }, show(['invite']), 'last_name'),
	{
		...bodyField(
			{ displayName: 'Role', name: 'role', type: 'options', options: USER_ROLE_OPTIONS, default: 'BUSINESS_USER', required: true },
			show(['invite']),
		),
		routing: {
			send: { type: 'body', property: 'role', preSend: [ensureIdempotencyKey] },
		},
	},
	{
		displayName: 'Additional Fields',
		name: 'inviteFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: show(['invite']),
		options: [
			...sharedBodyOptions(),
			bodyOption(
				{
					displayName: 'Create as Draft',
					name: 'isDraft',
					type: 'boolean',
					default: true,
					description: 'Whether to create a draft user without sending the invite email',
				},
				'is_draft',
			),
			bodyOption(
				{
					displayName: 'Idempotency Key',
					name: 'idempotencyKey',
					type: 'string',
					default: '',
					description:
						'Ramp ignores a repeat invite with the same key. Leave empty for a new key per run, or set one from your own data, such as the employee ID in your HR system, so a re-run cannot invite twice.',
				},
				'idempotency_key',
			),
		].sort(byDisplayName),
	},

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
			bodyOption({ displayName: 'First Name', name: 'firstName', type: 'string', default: '' }, 'first_name'),
			bodyOption({ displayName: 'Last Name', name: 'lastName', type: 'string', default: '' }, 'last_name'),
			bodyOption({ displayName: 'Role', name: 'role', type: 'options', options: USER_ROLE_OPTIONS, default: 'BUSINESS_USER' }, 'role'),
			bodyOption(
				{
					displayName: 'Auto-Promote Manager',
					name: 'autoPromote',
					type: 'boolean',
					default: false,
					description: "Whether to make the user's new direct manager a manager in Ramp",
				},
				'auto_promote',
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
		displayOptions: show(['getAll']),
		options: [
			queryOption({ displayName: 'Email', name: 'email', type: 'string', placeholder: 'name@email.com', default: '' }, 'email'),
			queryOption({ displayName: 'Employee ID', name: 'employeeId', type: 'string', default: '' }, 'employee_id'),
			queryOption({ displayName: 'Role', name: 'role', type: 'options', options: USER_ROLE_OPTIONS, default: 'BUSINESS_USER' }, 'role'),
			queryOption(
				{
					displayName: 'Status',
					name: 'status',
					type: 'options',
					options: [
						{ name: 'Active', value: 'USER_ACTIVE' },
						{ name: 'Draft', value: 'USER_DRAFT' },
						{ name: 'Inactive', value: 'USER_INACTIVE' },
						{ name: 'Suspended', value: 'USER_SUSPENDED' },
					],
					default: 'USER_ACTIVE',
				},
				'status',
			),
			queryOption({ displayName: 'Entity ID', name: 'entityId', type: 'string', default: '' }, 'entity_id'),
			queryOption({ displayName: 'Department ID', name: 'departmentId', type: 'string', default: '' }, 'department_id'),
			queryOption({ displayName: 'Location ID', name: 'locationId', type: 'string', default: '' }, 'location_id'),
		].sort(byDisplayName),
	},
	...userGeneratedProperties,
];
