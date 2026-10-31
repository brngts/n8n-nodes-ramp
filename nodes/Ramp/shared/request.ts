import type {
	DeclarativeRestApiSettings,
	IDataObject,
	IExecutePaginationFunctions,
	IExecuteSingleFunctions,
	IHttpRequestOptions,
	IN8nHttpFullResponse,
	INodeExecutionData,
} from 'n8n-workflow';
import { MAX_PAGES, MIN_PAGE_SIZE, PAGE_SIZE, RAMP_CREDENTIAL_NAME } from './constants';
import { toRampError } from './errors';

/**
 * - `record` returns the response body, one item per element when it is an array
 * - `list` unwraps the `data` array of a list response into one item per record
 *   and follows `page.next`
 * - `success` returns `{ success: true }` when Ramp answers with an empty body
 * - `binary` returns the response file, such as a remittance PDF, as binary data
 */
export type OutputMode = 'record' | 'list' | 'success' | 'binary';

export type RequestSettings = {
	output: OutputMode;
	/** Where a list endpoint takes `page_size` and `start`; `none` for lists that only follow `page.next`. */
	pageIn?: 'query' | 'body' | 'none';
	/** File name for `binary` output, before the record ID. */
	fileName?: string;
};

type ListPage = { data?: IDataObject[]; page?: { next?: string | null } };

/** The record a request is about, named in 404 messages: the first record picker that has a value. */
function findIdentifier(context: IExecuteSingleFunctions): string | undefined {
	const { parameters } = context.getNode();
	for (const value of Object.values(parameters)) {
		if (typeof value !== 'object' || value === null || !('__rl' in value)) continue;
		const id = (value as { value?: unknown }).value;
		if (typeof id === 'string' && id !== '' && !id.startsWith('=')) return id;
	}
	return undefined;
}

function hasContent(body: unknown): body is IDataObject | IDataObject[] {
	if (Array.isArray(body)) return true;
	return typeof body === 'object' && body !== null && Object.keys(body).length > 0;
}

function toItems(body: IDataObject | IDataObject[]): INodeExecutionData[] {
	return (Array.isArray(body) ? body : [body]).map((json) =>
		typeof json === 'object' && json !== null ? { json } : { json: { value: json } },
	);
}

/** The cursor in a `page.next` link, for lists that take it in the request body. */
export function cursorFrom(next: string): string {
	const match = next.match(/[?&]start=([^&]+)/);
	return match ? decodeURIComponent(match[1]) : next;
}

/**
 * Sends every routed request. It replaces declarative error handling
 * (`ignoreHttpStatusErrors` plus a postReceive check) for one reason: Ramp
 * access tokens expire, and n8n only fetches a new one when the request throws
 * on a 401. Letting the request throw keeps that working, and the catch below
 * still surfaces Ramp's own message.
 *
 * List endpoints use keyset pagination: each page carries `page.next`, the
 * complete URL of the next page with the cursor and the original filters.
 */
export function sendRampRequest(settings: OutputMode | RequestSettings) {
	const { output, pageIn = 'query', fileName = 'ramp' } =
		typeof settings === 'string' ? { output: settings } : settings;

	const send = async function (
		this: IExecutePaginationFunctions,
		requestData: DeclarativeRestApiSettings.ResultOptions,
	): Promise<INodeExecutionData[]> {
		const request = async (options: IHttpRequestOptions): Promise<unknown> => {
			try {
				return await this.helpers.httpRequestWithAuthentication.call(this, RAMP_CREDENTIAL_NAME, options);
			} catch (error) {
				throw toRampError(this.getNode(), error, { identifier: findIdentifier(this) });
			}
		};

		const options = requestData.options as IHttpRequestOptions;

		if (output === 'binary') {
			const response = (await request({
				...options,
				encoding: 'arraybuffer',
				json: false,
				returnFullResponse: true,
				headers: { ...(options.headers ?? {}), Accept: 'application/pdf, application/octet-stream, */*' },
			})) as IN8nHttpFullResponse;
			const contentType = String(response.headers?.['content-type'] ?? 'application/pdf').split(';')[0];
			const id = findIdentifier(this) ?? 'file';
			const extension = contentType === 'application/pdf' ? 'pdf' : (contentType.split('/')[1] ?? 'bin');
			const binaryPropertyName = String(this.getNodeParameter('binaryPropertyName', 'data'));
			const binaryData = await this.helpers.prepareBinaryData(
				Buffer.from(response.body as ArrayBuffer),
				`${fileName}-${id}.${extension}`,
				contentType,
			);
			return [{ json: { id, fileName: binaryData.fileName }, binary: { [binaryPropertyName]: binaryData } }];
		}

		if (output !== 'list') {
			const body = await request({ ...options, json: true });
			if (hasContent(body)) return toItems(body);
			return output === 'success' ? [{ json: { success: true } }] : [];
		}

		const returnAll = this.getNodeParameter('returnAll', false) as boolean;
		const limit = returnAll ? Infinity : Number(this.getNodeParameter('limit', 50));
		const pageSize = returnAll ? PAGE_SIZE : Math.min(Math.max(limit, MIN_PAGE_SIZE), PAGE_SIZE);

		const withPageSize = (base: IHttpRequestOptions): IHttpRequestOptions => {
			if (pageIn === 'none') return base;
			return pageIn === 'body'
				? { ...base, body: { ...((base.body as IDataObject) ?? {}), page_size: pageSize } }
				: { ...base, qs: { ...(base.qs ?? {}), page_size: pageSize } };
		};

		const records: IDataObject[] = [];
		let page = withPageSize({ ...options, json: true });
		for (let pageNumber = 0; pageNumber < MAX_PAGES; pageNumber++) {
			const response = (await request(page)) as ListPage | IDataObject[];
			// A list that does not come back in the documented shape is returned as is
			if (!Array.isArray(response) && !Array.isArray(response?.data)) {
				return hasContent(response) ? toItems(response) : [];
			}
			records.push(...(Array.isArray(response) ? response : (response.data ?? [])));
			const next = Array.isArray(response) ? undefined : response.page?.next;
			if (records.length >= limit || !next || next === page.url) break;
			if (pageIn === 'body') {
				const body = (page.body as IDataObject) ?? {};
				const start = cursorFrom(next);
				if (start === body.start) break;
				page = { ...page, body: { ...body, start } };
			} else {
				// `next` is absolute and already carries every filter, so nothing else is sent
				page = { ...options, json: true, baseURL: undefined, url: next, qs: undefined } as IHttpRequestOptions;
			}
		}
		return toItems(records.slice(0, limit));
	};
	// Kept on the function so the description tests can check what each operation sends
	return Object.assign(send, { settings: { output, pageIn, fileName } });
}
