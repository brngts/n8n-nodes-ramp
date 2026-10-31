import { NodeApiError, type INode, type JsonObject } from 'n8n-workflow';

/** Hints shown under Ramp's own message for the errors users run into most. */
export const DESCRIPTIONS_BY_STATUS: Record<number, string> = {
	400: 'Ramp rejected the request. Check the values you entered against the Ramp API reference.',
	401: 'Ramp did not accept the access token. Check the client ID and secret, and that the credential Environment matches the app (sandbox apps only work on demo-api.ramp.com).',
	403: 'The token is missing a scope this action needs, or the Ramp plan does not include the feature. Add the scope to both the Ramp developer app and the credential, then reconnect.',
	404: 'Check the ID. IDs only exist in the environment they were created in.',
	409: 'The record is in a state that does not allow this action.',
	422: 'Ramp could not process the values sent. The message above names the field.',
	429: 'Ramp allows 200 requests per 10 seconds per IP address, shared by every workflow on this n8n instance. Space requests out with the batching settings under the node options.',
	504: 'Ramp timed out. Retry the request later, or narrow a Get Many with filters.',
};

function parseBody(body: unknown): unknown {
	if (Buffer.isBuffer(body) || body instanceof ArrayBuffer) {
		body = Buffer.from(body as ArrayBuffer).toString('utf8');
	}
	if (typeof body === 'string') {
		try {
			return JSON.parse(body);
		} catch {
			return body;
		}
	}
	return body;
}

/** Flattens Ramp's `additional_info` field errors, such as `{ page_size: ["Value must be..."] }`. */
function describeFieldErrors(info: unknown): string | undefined {
	if (typeof info !== 'object' || info === null || Array.isArray(info)) return undefined;
	const parts = Object.entries(info as Record<string, unknown>).map(([field, value]) => {
		const text = Array.isArray(value) ? value.map(String).join('; ') : JSON.stringify(value);
		return `${field}: ${text}`;
	});
	return parts.length > 0 ? parts.join(', ') : undefined;
}

export type RampApiErrorDetails = { message?: string; code?: string; fields?: string };

/**
 * Ramp error bodies carry `error_v2: { error_code, message, additional_info }`,
 * plus a legacy `error` field. Token errors use OAuth's `error_description`.
 */
export function readApiError(rawBody: unknown): RampApiErrorDetails {
	const body = parseBody(rawBody);
	if (typeof body === 'string') return body.trim() !== '' ? { message: body.trim() } : {};
	if (typeof body !== 'object' || body === null) return {};
	const { error_v2: errorV2, error, message, error_description: errorDescription } = body as Record<
		string,
		unknown
	>;

	if (typeof errorV2 === 'object' && errorV2 !== null) {
		const v2 = errorV2 as Record<string, unknown>;
		return {
			message: typeof v2.message === 'string' && v2.message !== '' ? v2.message : undefined,
			code: typeof v2.error_code === 'string' ? v2.error_code : undefined,
			fields: describeFieldErrors(v2.additional_info),
		};
	}
	if (typeof errorDescription === 'string') return { message: errorDescription };
	if (typeof message === 'string' && message !== '') return { message };
	if (typeof error === 'string' && error !== '') return { message: error };
	if (typeof error === 'object' && error !== null) {
		const nested = error as Record<string, unknown>;
		if (typeof nested.message === 'string') return { message: nested.message };
		return { fields: describeFieldErrors(error) };
	}
	return {};
}

type ErrorResponse = { status?: number; data?: unknown; body?: unknown; headers?: Record<string, unknown> };

function findResponse(error: unknown): ErrorResponse | undefined {
	if (typeof error !== 'object' || error === null) return undefined;
	const candidates: unknown[] = [error];
	if ('cause' in error) candidates.push(error.cause);
	for (const candidate of candidates) {
		if (typeof candidate === 'object' && candidate !== null && 'response' in candidate) {
			const response = (candidate as { response: unknown }).response;
			if (typeof response === 'object' && response !== null) return response as ErrorResponse;
		}
	}
	return undefined;
}

function readStatusCode(error: unknown, response: ErrorResponse | undefined): number | undefined {
	const candidates: unknown[] = [response?.status];
	if (typeof error === 'object' && error !== null) {
		if ('httpCode' in error) candidates.push(error.httpCode);
		if ('statusCode' in error) candidates.push(error.statusCode);
	}
	for (const candidate of candidates) {
		const parsed = Number(candidate);
		if (Number.isInteger(parsed) && parsed >= 100 && parsed <= 599) return parsed;
	}
	return undefined;
}

type ToRampErrorOptions = {
	/** The record the request was about, named in 404 messages. */
	identifier?: string;
};

/**
 * Rethrows a failed request as an error that leads with Ramp's own message
 * instead of n8n's generic one, and keeps Ramp's error code and trace ID so
 * the failure can be raised with Ramp support.
 */
export function toRampError(node: INode, error: unknown, { identifier }: ToRampErrorOptions = {}): NodeApiError {
	if (error instanceof NodeApiError && error.context.rampHandled === true) return error;

	const response = findResponse(error);
	const statusCode = readStatusCode(error, response);
	const details = readApiError(response?.data ?? response?.body);
	const traceId = response?.headers?.['x-trace-id'];
	const fallback = error instanceof Error ? error.message : String(error);

	const apiMessage = details.message ?? details.fields;
	const message =
		statusCode === 404 && identifier
			? `Ramp could not find "${identifier}"`
			: (apiMessage ?? (statusCode ? `Ramp request failed with status ${statusCode}` : fallback));

	const description = [
		statusCode === 404 && identifier ? apiMessage : undefined,
		details.message && details.fields ? details.fields : undefined,
		statusCode === undefined ? undefined : DESCRIPTIONS_BY_STATUS[statusCode],
		details.code ? `Ramp error code: ${details.code}.` : undefined,
		typeof traceId === 'string' ? `Trace ID: ${traceId}.` : undefined,
	]
		.filter(Boolean)
		.join(' ');

	const errorBody: JsonObject = {
		statusCode: statusCode ?? null,
		message,
		errorCode: details.code ?? null,
		traceId: typeof traceId === 'string' ? traceId : null,
	};
	const wrapped = new NodeApiError(node, errorBody, {
		message,
		description: description || undefined,
		httpCode: statusCode === undefined ? undefined : String(statusCode),
	});
	wrapped.context.rampHandled = true;
	return wrapped;
}
