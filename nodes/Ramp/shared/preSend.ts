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

/**
 * Sends a JSON parameter as a single body property, for a required nested
 * value such as a list of line items or an address.
 */
export function setJsonBodyValue(parameterName: string, bodyProperty: string, label: string, kind: 'object' | 'array') {
	return async function (
		this: IExecuteSingleFunctions,
		requestOptions: IHttpRequestOptions,
	): Promise<IHttpRequestOptions> {
		const raw = this.getNodeParameter(parameterName, kind === 'array' ? '[]' : '{}');
		const value = kind === 'array' ? parseJsonArray(this, raw, label) : parseJsonObject(this, raw, label);
		requestOptions.body = { ...((requestOptions.body ?? {}) as IDataObject), [bodyProperty]: value };
		return requestOptions;
	};
}

/** Splits a comma-separated parameter into a list for a body property that takes an array of strings. */
export function setListBodyValue(parameterName: string, bodyProperty: string) {
	return async function (
		this: IExecuteSingleFunctions,
		requestOptions: IHttpRequestOptions,
	): Promise<IHttpRequestOptions> {
		const raw = this.getNodeParameter(parameterName, '') as string | string[];
		const values = (Array.isArray(raw) ? raw : String(raw).split(','))
			.map((value) => String(value).trim())
			.filter((value) => value !== '');
		const body = (requestOptions.body ?? {}) as IDataObject;
		requestOptions.body = values.length > 0 ? { ...body, [bodyProperty]: values } : body;
		return requestOptions;
	};
}

/**
 * Sends `X-Idempotency-Key`, which some create endpoints accept or require.
 * Without a value from the workflow, every item gets a fresh key.
 */
export function setIdempotencyHeader(parameterName: string) {
	return async function (
		this: IExecuteSingleFunctions,
		requestOptions: IHttpRequestOptions,
	): Promise<IHttpRequestOptions> {
		const value = String(this.getNodeParameter(parameterName, '') ?? '').trim();
		requestOptions.headers = { ...(requestOptions.headers ?? {}), 'X-Idempotency-Key': value || randomUUID() };
		return requestOptions;
	};
}

type FilePart = {
	/** Form field Ramp expects the file under, such as `file` or `receipt`. */
	field: string;
	/** Node parameter holding the input binary field name(s), comma-separated for several files. */
	parameter: string;
};

/**
 * Turns the routed body into `multipart/form-data` for upload endpoints. The
 * body is encoded here, with an explicit boundary, so the request does not
 * depend on how the HTTP client treats form objects. Text fields are sent as
 * strings, nested values as JSON.
 */
export function toMultipartBody(files: FilePart[]) {
	return async function (
		this: IExecuteSingleFunctions,
		requestOptions: IHttpRequestOptions,
	): Promise<IHttpRequestOptions> {
		const boundary = `----n8nRampBoundary${randomUUID().replace(/-/g, '')}`;
		const parts: Buffer[] = [];
		const fields = (requestOptions.body ?? {}) as IDataObject;

		for (const [name, value] of Object.entries(fields)) {
			if (value === undefined || value === null) continue;
			const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
			parts.push(
				Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${text}\r\n`),
			);
		}

		for (const { field, parameter } of files) {
			const names = String(this.getNodeParameter(parameter, 'data'))
				.split(',')
				.map((name) => name.trim())
				.filter((name) => name !== '');
			for (const binaryPropertyName of names) {
				const binary = this.helpers.assertBinaryData(binaryPropertyName);
				const buffer = await this.helpers.getBinaryDataBuffer(binaryPropertyName);
				const fileName = (binary.fileName ?? `${field}.${binary.fileExtension ?? 'bin'}`).replace(/"/g, '');
				parts.push(
					Buffer.from(
						`--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="${fileName}"\r\nContent-Type: ${binary.mimeType || 'application/octet-stream'}\r\n\r\n`,
					),
					buffer,
					Buffer.from('\r\n'),
				);
			}
		}

		parts.push(Buffer.from(`--${boundary}--\r\n`));
		requestOptions.body = Buffer.concat(parts);
		requestOptions.headers = {
			...(requestOptions.headers ?? {}),
			'Content-Type': `multipart/form-data; boundary=${boundary}`,
		};
		return requestOptions;
	};
}
