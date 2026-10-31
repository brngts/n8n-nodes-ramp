import { randomUUID } from 'node:crypto';
import {
	NodeOperationError,
	type IDataObject,
	type IExecuteSingleFunctions,
	type IHttpRequestOptions,
} from 'n8n-workflow';

function parseJson(context: IExecuteSingleFunctions, value: unknown, label: string): unknown {
	if (typeof value !== 'string') return value;
	try {
		return JSON.parse(value);
	} catch {
		throw new NodeOperationError(context.getNode(), `${label} is not valid JSON`, {
			description: 'Check for missing quotes, trailing commas or unescaped characters.',
		});
	}
}

function parseJsonObject(context: IExecuteSingleFunctions, value: unknown, label: string): IDataObject {
	if (value === undefined || value === null || value === '') return {};
	const parsed = parseJson(context, value, label);
	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		throw new NodeOperationError(context.getNode(), `${label} must be a JSON object`, {
			description: 'Wrap the fields in curly braces, for example {"memo": "Q3 licences"}.',
		});
	}
	return parsed as IDataObject;
}

function parseJsonArray(context: IExecuteSingleFunctions, value: unknown, label: string): IDataObject[] {
	if (value === undefined || value === null || value === '') return [];
	const parsed = parseJson(context, value, label);
	if (!Array.isArray(parsed)) {
		throw new NodeOperationError(context.getNode(), `${label} must be a JSON array`, {
			description: 'Wrap the entries in square brackets, for example [{"amount": 5000}].',
		});
	}
	return parsed as IDataObject[];
}

/**
 * Merges a JSON parameter into the request body, for the nested structures
 * (accounting codings, payment details, addresses) that do not fit a flat form.
 * Fields set through the node's own parameters win over the same key in the JSON.
 */
export function mergeJsonBody(parameterName: string, label: string) {
	return async function (
		this: IExecuteSingleFunctions,
		requestOptions: IHttpRequestOptions,
	): Promise<IHttpRequestOptions> {
		const extra = parseJsonObject(this, this.getNodeParameter(parameterName, '{}'), label);
		const body = (requestOptions.body ?? {}) as IDataObject;
		requestOptions.body = { ...extra, ...body };
		return requestOptions;
	};
}

/** Sends a JSON array parameter as a single body property, such as a bill's `line_items`. */
export function setJsonArrayBodyProperty(parameterName: string, bodyProperty: string, label: string) {
	return async function (
		this: IExecuteSingleFunctions,
		requestOptions: IHttpRequestOptions,
	): Promise<IHttpRequestOptions> {
		const value = parseJsonArray(this, this.getNodeParameter(parameterName, '[]'), label);
		requestOptions.body = { ...((requestOptions.body ?? {}) as IDataObject), [bodyProperty]: value };
		return requestOptions;
	};
}

/**
 * Some Ramp endpoints require an `idempotency_key` in the body. A fresh key per
 * item is used unless the workflow sets one, for example from an upstream ID,
 * so that re-running the workflow cannot create the record twice.
 */
export function ensureIdempotencyKey(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const body = (requestOptions.body ?? {}) as IDataObject;
	if (typeof body.idempotency_key !== 'string' || body.idempotency_key === '') {
		body.idempotency_key = randomUUID();
	}
	requestOptions.body = body;
	return Promise.resolve(requestOptions);
}
