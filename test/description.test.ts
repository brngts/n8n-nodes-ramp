import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SCOPES } from '../credentials/RampOAuth2Api.credentials';
import { Ramp } from '../nodes/Ramp/Ramp.node';
import { RampTrigger } from '../nodes/RampTrigger/RampTrigger.node';
import rampPaths from './fixtures/ramp-paths.json';

const node = new Ramp();
const { properties } = node.description;

type DocumentedEndpoints = Record<string, Record<string, { query: string[]; body: string[] }>>;
const documented: DocumentedEndpoints = rampPaths;

/** Body fields that preSend functions add, which `routing.send.property` cannot show. */
const PRE_SEND_BODY_FIELDS: Record<string, string[]> = {
	'transaction.split': ['line_items'],
	'bill.create': ['line_items'],
	'purchaseOrder.create': ['line_items'],
	'user.invite': ['idempotency_key'],
};

/** Query parameters `sendRampRequest` adds to every list request. */
const PAGINATION_QUERY = ['page_size'];

function isOption(option: unknown): option is INodePropertyOptions {
	return typeof option === 'object' && option !== null && 'value' in option;
}

function operationsFor(resource: string) {
	const operation = properties.find(
		(property) =>
			property.name === 'operation' && property.displayOptions?.show?.resource?.includes(resource),
	);
	return (operation?.options ?? []).filter(isOption);
}

/** Options of a top-level parameter, used to expand URLs such as `/cards/{{$parameter.cardType}}`. */
function parameterValues(name: string): string[] {
	const property = properties.find((candidate) => candidate.name === name && candidate.type === 'options');
	return (property?.options ?? []).filter(isOption).map((option) => String(option.value));
}

type ConcreteUrl = { url: string; bindings: Record<string, string> };

/**
 * Every concrete URL a routed URL can produce, with record IDs replaced by
 * `:id`. `bindings` holds the option chosen for each expanded parameter, so
 * fields shown only for that option can be checked against the right endpoint.
 */
function concreteUrls(url: string): ConcreteUrl[] {
	let urls: ConcreteUrl[] = [{ url: url.replace(/^=/, ''), bindings: {} }];
	for (const [, parameter] of url.matchAll(/\{\{\s*\$parameter\.(\w+)\s*\}\}/g)) {
		const values = parameterValues(parameter);
		if (values.length === 0) continue;
		const placeholder = new RegExp(`\\{\\{\\s*\\$parameter\\.${parameter}\\s*\\}\\}`);
		urls = urls.flatMap((candidate) =>
			values.map((value) => ({
				url: candidate.url.replace(placeholder, value),
				bindings: { ...candidate.bindings, [parameter]: value },
			})),
		);
	}
	return urls.map((candidate) => ({ ...candidate, url: candidate.url.replace(/\{\{[^}]+\}\}/g, ':id') }));
}

/** Matches a concrete URL such as `/bills/:id` to its spec path. Literal segments win over `{id}` ones. */
function specPathFor(concrete: string): string | undefined {
	const matches = Object.keys(documented).filter((path) =>
		new RegExp(`^${path.replace(/\{[^}]+\}/g, '[^/]+')}$`).test(concrete),
	);
	return matches.sort((a, b) => (a.match(/\{/g)?.length ?? 0) - (b.match(/\{/g)?.length ?? 0))[0];
}

type SentParameter = { type: 'query' | 'body'; property: string };

/** Collects `routing.send` declarations, including those nested in collections, expanding `={{ $value }}` names. */
function sendsIn(property: INodeProperties): SentParameter[] {
	const send = property.routing?.send;
	let own: SentParameter[] = [];
	if ((send?.type === 'query' || send?.type === 'body') && send.property) {
		const type = send.type;
		own =
			send.property === '={{ $value }}'
				? (property.options ?? []).filter(isOption).map((option) => ({ type, property: String(option.value) }))
				: [{ type, property: send.property }];
	}

	const nested = (property.options ?? []).flatMap((option) => {
		if (typeof option !== 'object' || option === null) return [];
		const candidates = 'values' in option ? (option.values ?? []) : [option];
		return candidates
			.filter((candidate): candidate is INodeProperties => 'type' in candidate)
			.flatMap(sendsIn);
	});

	return [...own, ...nested];
}

function parametersSentBy(
	resource: string,
	operation: INodePropertyOptions,
	bindings: Record<string, string> = {},
): SentParameter[] {
	const fromFields = properties
		.filter((property) => {
			const show = property.displayOptions?.show;
			if (!show?.resource?.includes(resource)) return false;
			if (show.operation && !show.operation.includes(operation.value)) return false;
			return Object.entries(bindings).every(([name, value]) => !show[name] || show[name]?.includes(value));
		})
		.flatMap(sendsIn);

	const fromPreSend = (PRE_SEND_BODY_FIELDS[`${resource}.${String(operation.value)}`] ?? []).map(
		(property) => ({ type: 'body' as const, property }),
	);

	return [...fromFields, ...fromPreSend];
}

const resourceValues = (properties.find((property) => property.name === 'resource')?.options ?? [])
	.filter(isOption)
	.map((option) => String(option.value));

describe('Ramp node description', () => {
	it('sends every operation through sendRampRequest', () => {
		expect(resourceValues.length).toBe(11);
		for (const resource of resourceValues) {
			const operations = operationsFor(resource);
			expect(operations.length, resource).toBeGreaterThan(0);
			for (const operation of operations) {
				const where = `${resource}.${String(operation.value)}`;
				expect(operation.routing?.request?.url, where).toMatch(/^=?\//);
				expect(operation.routing?.send?.paginate, where).toBe(true);
				expect(typeof operation.routing?.operations?.pagination, where).toBe('function');
				// Ignoring HTTP errors would stop n8n from renewing an expired token
				expect(operation.routing?.request?.ignoreHttpStatusErrors, where).toBeUndefined();
			}
		}
	});

	it('only shows parameters for resources and operations that exist', () => {
		for (const property of properties) {
			const show = property.displayOptions?.show;
			if (!show) continue;
			for (const resource of show.resource ?? []) {
				expect(resourceValues, property.name).toContain(resource);
				for (const operation of show.operation ?? []) {
					expect(
						operationsFor(String(resource)).map((option) => option.value),
						property.name,
					).toContain(operation);
				}
			}
		}
	});

	it('only calls endpoints and methods that exist in the Ramp OpenAPI spec', () => {
		for (const resource of resourceValues) {
			for (const operation of operationsFor(resource)) {
				const { url, method } = operation.routing?.request ?? {};
				for (const { url: concrete } of concreteUrls(String(url))) {
					const path = specPathFor(concrete);
					expect(path, `${resource}.${String(operation.value)} uses unknown path ${concrete}`).toBeDefined();
					expect(Object.keys(documented[String(path)]), `${resource}.${String(operation.value)} ${method} ${concrete}`).toContain(
						method,
					);
				}
			}
		}
	});

	it('only sends query and body parameters the endpoint accepts', () => {
		const problems: string[] = [];
		let checked = 0;
		for (const resource of resourceValues) {
			for (const operation of operationsFor(resource)) {
				const { url, method } = operation.routing?.request ?? {};
				const isList = String(operation.value) === 'getAll';
				for (const { url: concrete, bindings } of concreteUrls(String(url))) {
					const sent = [
						...parametersSentBy(resource, operation, bindings),
						...(isList ? PAGINATION_QUERY.map((property) => ({ type: 'query' as const, property })) : []),
					];
					const accepted = documented[String(specPathFor(concrete))]?.[String(method)];
					if (!accepted) continue; // covered by the endpoint test above
					for (const { type, property } of sent) {
						checked += 1;
						const allowed = type === 'query' ? accepted.query : accepted.body;
						if (!allowed.includes(property)) {
							problems.push(
								`${resource}.${String(operation.value)} sends ${type} "${property}", which ${method} ${concrete} does not accept`,
							);
						}
					}
				}
			}
		}
		expect(problems).toEqual([]);
		// Guards against the collector walking past every field and reporting a clean run.
		expect(checked).toBeGreaterThan(200);
	});

	it('keeps collection entries and options in alphabetical order', () => {
		const unsorted: string[] = [];
		const check = (names: string[], where: string) => {
			const sorted = [...names].sort((a, b) => a.localeCompare(b));
			if (names.join('|') !== sorted.join('|')) unsorted.push(where);
		};
		for (const property of properties) {
			if (property.type === 'collection') {
				check(
					(property.options ?? []).map((option) => ('displayName' in option ? option.displayName : '')),
					`${property.name} for ${JSON.stringify(property.displayOptions?.show)}`,
				);
				for (const option of property.options ?? []) {
					if ('type' in option && option.type === 'options') {
						check((option.options ?? []).filter(isOption).map((o) => o.name), `${property.name}.${option.name}`);
					}
				}
			}
			if (property.type === 'options' && property.name !== 'operation') {
				check((property.options ?? []).filter(isOption).map((o) => o.name), property.name);
			}
			if (property.name === 'operation') {
				check((property.options ?? []).filter(isOption).map((o) => o.name), `operations of ${property.displayOptions?.show?.resource}`);
			}
		}
		expect(unsorted).toEqual([]);
	});

	it('uses the right indefinite article in every visible string', () => {
		const texts: string[] = [];
		const collect = (property: INodeProperties) => {
			texts.push(property.displayName, property.description ?? '', property.placeholder ?? '');
			for (const option of property.options ?? []) {
				if ('action' in option) texts.push(option.name, option.action ?? '', option.description ?? '');
				else if ('type' in option) collect(option);
			}
		};
		properties.forEach(collect);
		const wrong = texts.filter((text) => /\ba [aeio]/i.test(text) || /\ban [^aeiou]/i.test(text));
		expect(wrong).toEqual([]);
	});

	it('registers every list search method it references', () => {
		const methods = properties.flatMap((property) =>
			(property.modes ?? []).flatMap((mode) => {
				const method = mode.typeOptions?.searchListMethod;
				return method ? [method] : [];
			}),
		);
		expect(methods.length).toBeGreaterThan(0);
		for (const method of methods) {
			expect(node.methods.listSearch).toHaveProperty(method);
		}
	});

	it('requests well-formed default scopes, including the one the credential test uses', () => {
		const scopes = DEFAULT_SCOPES.split(' ');
		for (const scope of scopes) expect(scope).toMatch(/^[a-z_]+:(read|write)$/);
		expect(new Set(scopes).size).toBe(scopes.length);
		expect(scopes).toContain('business:read');
	});
});

describe('Ramp Trigger node description', () => {
	const trigger = new RampTrigger();

	it('is a webhook trigger with a full lifecycle', () => {
		expect(trigger.description.group).toEqual(['trigger']);
		expect(trigger.description.inputs).toEqual([]);
		expect(trigger.description.webhooks?.[0]?.httpMethod).toBe('POST');
		expect(Object.keys(trigger.webhookMethods.default).sort()).toEqual(['checkExists', 'create', 'delete']);
	});

	it('only manages webhook subscriptions through documented routes', () => {
		expect(documented['/webhooks']).toHaveProperty('GET');
		expect(documented['/webhooks'].POST.body).toEqual(expect.arrayContaining(['endpoint_url', 'event_types']));
		expect(documented['/webhooks/{webhook_id}']).toHaveProperty('DELETE');
		expect(documented['/webhooks/{webhook_id}/verify'].POST.body).toContain('challenge');
	});

	it('offers every business event and never the setup ones', () => {
		const events = trigger.description.properties.find((property) => property.name === 'events');
		const values = (events?.options ?? []).filter(isOption).map((option) => String(option.value));
		expect(values).toContain('transactions.cleared');
		expect(values).toContain('bills.paid');
		expect(values).not.toContain('webhooks.verification');
		expect(values).not.toContain('tests.test_event');
	});
});
