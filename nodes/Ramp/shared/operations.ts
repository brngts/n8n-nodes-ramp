import type { IHttpRequestMethods, INodeProperties, INodePropertyOptions } from 'n8n-workflow';
import { sendRampRequest, type OutputMode, type RequestSettings } from './request';

type OperationOptions = {
	name: string;
	value: string;
	action: string;
	description: string;
	method: IHttpRequestMethods;
	url: string;
	/** How the response becomes items, see `sendRampRequest`. */
	output?: OutputMode | RequestSettings;
	request?: Record<string, unknown>;
};

/**
 * One operation of a resource. Routing builds the request (URL, query, body,
 * preSend), and `sendRampRequest` sends it, see there for why.
 */
export function operation({
	name,
	value,
	action,
	description,
	method,
	url,
	output = 'record',
	request = {},
}: OperationOptions): INodePropertyOptions {
	return {
		name,
		value,
		action,
		description,
		routing: {
			request: {
				method,
				url,
				...request,
			},
			send: { paginate: true },
			operations: { pagination: sendRampRequest(output) },
		},
	};
}

/** The "Operation" dropdown for a resource, in alphabetical order. */
export function operationSelector(
	resource: string,
	options: INodePropertyOptions[],
	defaultOperation: string,
): INodeProperties {
	return {
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: [resource] } },
		options: [...options].sort((a, b) => a.name.localeCompare(b.name)),
		default: defaultOperation,
	};
}
