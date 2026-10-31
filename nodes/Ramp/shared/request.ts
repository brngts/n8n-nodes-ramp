import type {
	DeclarativeRestApiSettings,
	IDataObject,
	IExecutePaginationFunctions,
	IExecuteSingleFunctions,
	IHttpRequestOptions,
	INodeExecutionData,
} from 'n8n-workflow';
import { MAX_PAGES, MIN_PAGE_SIZE, PAGE_SIZE, RAMP_CREDENTIAL_NAME } from './constants';
import { toRampError } from './errors';

/**
 * `record` returns the response body, `list` unwraps the `data` array of a list
 * response into one item per record and follows `page.next`, `success` returns
 * `{ success: true }` when Ramp answers with an empty body.
 */
export type OutputMode = 'record' | 'list' | 'success';

type ListPage = { data?: IDataObject[]; page?: { next?: string | null } };

/**
 * Identifier parameters, in the order they should be reported. Only one of
 * these is on screen for any given operation.
 */
const IDENTIFIER_PARAMETERS = [
	'transaction',
	'bill',
	'reimbursement',
	'receipt',
	'card',
	'fund',
	'user',
	'vendor',
	'department',
	'purchaseOrder',
	'entity',
] as const;

function findIdentifier(context: IExecuteSingleFunctions): string | undefined {
	const { parameters } = context.getNode();
	for (const parameter of IDENTIFIER_PARAMETERS) {
		// `extractValue` throws for parameters the current operation does not define
		if (!(parameter in parameters)) continue;
		try {
			const value = context.getNodeParameter(parameter, '', { extractValue: true });
			if (typeof value === 'string' && value !== '') return value;
		} catch {
			continue;
		}
	}
	return undefined;
}

function hasContent(body: unknown): body is IDataObject | IDataObject[] {
	if (Array.isArray(body)) return true;
	return typeof body === 'object' && body !== null && Object.keys(body).length > 0;
}

function toItems(body: IDataObject | IDataObject[]): INodeExecutionData[] {
	return (Array.isArray(body) ? body : [body]).map((json) => ({ json }));
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
export function sendRampRequest(output: OutputMode) {
	return async function (
		this: IExecutePaginationFunctions,
		requestData: DeclarativeRestApiSettings.ResultOptions,
	): Promise<INodeExecutionData[]> {
		const request = async (options: IHttpRequestOptions): Promise<unknown> => {
			try {
				return await this.helpers.httpRequestWithAuthentication.call(this, RAMP_CREDENTIAL_NAME, {
					...options,
					json: true,
				});
			} catch (error) {
				throw toRampError(this.getNode(), error, { identifier: findIdentifier(this) });
			}
		};

		const options = requestData.options as IHttpRequestOptions;

		if (output !== 'list') {
			const body = await request(options);
			if (hasContent(body)) return toItems(body);
			return output === 'success' ? [{ json: { success: true } }] : [];
		}

		const returnAll = this.getNodeParameter('returnAll', false) as boolean;
		const limit = returnAll ? Infinity : Number(this.getNodeParameter('limit', 50));
		const pageSize = returnAll ? PAGE_SIZE : Math.min(Math.max(limit, MIN_PAGE_SIZE), PAGE_SIZE);

		const records: IDataObject[] = [];
		let page: IHttpRequestOptions = { ...options, qs: { ...(options.qs ?? {}), page_size: pageSize } };
		for (let pageNumber = 0; pageNumber < MAX_PAGES; pageNumber++) {
			const response = (await request(page)) as ListPage;
			records.push(...(response.data ?? []));
			const next = response.page?.next;
			if (records.length >= limit || !next || next === page.url) break;
			// `next` is absolute and already carries every filter, so nothing else is sent
			page = { ...options, baseURL: undefined, url: next, qs: undefined } as IHttpRequestOptions;
		}
		return toItems(records.slice(0, limit));
	};
}
