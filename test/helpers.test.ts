import type { DeclarativeRestApiSettings, IExecutePaginationFunctions, IHttpRequestOptions, INode } from 'n8n-workflow';
import { describe, expect, it, vi } from 'vitest';
import { readApiError, toRampError } from '../nodes/Ramp/shared/errors';
import { sendRampRequest } from '../nodes/Ramp/shared/request';

const node: INode = {
	id: '1',
	name: 'Ramp',
	type: 'n8n-nodes-ramp-api.ramp',
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
};

describe('readApiError', () => {
	it('reads error_v2 with its code and field errors', () => {
		expect(
			readApiError({
				error_v2: {
					error_code: 'DEVELOPER_7001',
					message: 'Value must be between 2 and 100',
					additional_info: { page_size: ['Value must be between 2 and 100'] },
				},
				error: { page_size: ['Value must be between 2 and 100'] },
			}),
		).toEqual({
			message: 'Value must be between 2 and 100',
			code: 'DEVELOPER_7001',
			fields: 'page_size: Value must be between 2 and 100',
		});
	});

	it('falls back to OAuth, legacy and plain bodies', () => {
		expect(readApiError({ error: 'invalid_scope', error_description: 'Scope not allowed' })).toEqual({
			message: 'Scope not allowed',
		});
		expect(readApiError('{"message":"Not found"}')).toEqual({ message: 'Not found' });
		expect(readApiError({ error: { memo: ['Missing data'] } })).toEqual({ fields: 'memo: Missing data' });
		expect(readApiError('')).toEqual({});
	});
});

function axiosLikeError(status: number, data: unknown, headers: Record<string, string> = {}) {
	const cause = Object.assign(new Error(`Request failed with status code ${status}`), {
		response: { status, data, headers },
	});
	// The shape httpRequestWithAuthentication throws: the axios error sits in `cause`
	return Object.assign(new Error('wrapped'), { cause, httpCode: String(status) });
}

describe('toRampError', () => {
	it("leads with Ramp's message and keeps the code and trace ID", () => {
		const error = toRampError(
			node,
			axiosLikeError(
				403,
				{ error_v2: { error_code: 'DEVELOPER_7100', message: 'These scopes are not allowed for this token: bills:write' } },
				{ 'x-trace-id': 'trace-123' },
			),
		);
		expect(error.message).toBe('These scopes are not allowed for this token: bills:write');
		expect(error.description).toContain('scope');
		expect(error.description).toContain('DEVELOPER_7100');
		expect(error.description).toContain('trace-123');
		expect(error.httpCode).toBe('403');
	});

	it('names the record on a 404', () => {
		const error = toRampError(node, axiosLikeError(404, { error_v2: { message: 'Bill not found' } }), {
			identifier: 'bill-1',
		});
		expect(error.message).toBe('Ramp could not find "bill-1"');
		expect(error.description).toContain('Bill not found');
	});

	it('does not wrap twice', () => {
		const first = toRampError(node, axiosLikeError(500, {}));
		expect(toRampError(node, first)).toBe(first);
	});
});

type Call = IHttpRequestOptions;

function paginationContext(parameters: Record<string, unknown>, pages: unknown[]) {
	const calls: Call[] = [];
	const responses = [...pages];
	const context = {
		getNode: () => ({ ...node, parameters }),
		getNodeParameter: (name: string, fallback: unknown) => (name in parameters ? parameters[name] : fallback),
		helpers: {
			httpRequestWithAuthentication: vi.fn(async (_credential: string, options: Call) => {
				calls.push(options);
				return responses.shift();
			}),
		},
	};
	return { context: context as unknown as IExecutePaginationFunctions, calls };
}

const listRequest = (qs: Record<string, unknown> = {}): DeclarativeRestApiSettings.ResultOptions =>
	({
		options: { baseURL: 'https://api.ramp.com/developer/v1', url: '/bills', method: 'GET', qs },
		preSend: [],
		postReceive: [],
		requestOperations: {},
	}) as unknown as DeclarativeRestApiSettings.ResultOptions;

describe('sendRampRequest', () => {
	it('follows page.next until it runs out when Return All is on', async () => {
		const { context, calls } = paginationContext({ returnAll: true }, [
			{ data: [{ id: '1' }, { id: '2' }], page: { next: 'https://api.ramp.com/developer/v1/bills?page_size=100&start=2' } },
			{ data: [{ id: '3' }], page: { next: null } },
		]);
		const items = await sendRampRequest('list').call(context, listRequest({ vendor_id: 'v1' }));
		expect(items.map((item) => item.json.id)).toEqual(['1', '2', '3']);
		expect(calls[0].qs).toEqual({ vendor_id: 'v1', page_size: 100 });
		expect(calls[1].url).toBe('https://api.ramp.com/developer/v1/bills?page_size=100&start=2');
		expect(calls[1].baseURL).toBeUndefined();
		expect(calls[1].qs).toBeUndefined();
	});

	it('stops at the limit and never asks for a page below the minimum size', async () => {
		const { context, calls } = paginationContext({ returnAll: false, limit: 1 }, [
			{ data: [{ id: '1' }, { id: '2' }], page: { next: 'https://api.ramp.com/developer/v1/bills?start=2' } },
		]);
		const items = await sendRampRequest('list').call(context, listRequest());
		expect(items).toHaveLength(1);
		expect(calls).toHaveLength(1);
		expect(calls[0].qs).toEqual({ page_size: 2 });
	});

	it('returns success for an empty body and the record otherwise', async () => {
		const empty = paginationContext({}, ['']);
		expect(await sendRampRequest('success').call(empty.context, listRequest())).toEqual([{ json: { success: true } }]);
		const record = paginationContext({}, [{ id: 'b1' }]);
		expect(await sendRampRequest('record').call(record.context, listRequest())).toEqual([{ json: { id: 'b1' } }]);
	});

	it("rethrows HTTP errors with Ramp's message", async () => {
		const { context } = paginationContext({}, []);
		(context.helpers.httpRequestWithAuthentication as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
			axiosLikeError(422, { error_v2: { message: 'invoice_number is required' } }),
		);
		await expect(sendRampRequest('record').call(context, listRequest())).rejects.toThrow('invoice_number is required');
	});
});
