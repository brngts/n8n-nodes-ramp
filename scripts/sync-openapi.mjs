#!/usr/bin/env node
/**
 * Pulls Ramp's live OpenAPI spec and webhooks guide and regenerates:
 *   - test/fixtures/ramp-paths.json: every path, method and accepted
 *     query/body parameter, which the description tests check the node against
 *   - nodes/RampTrigger/events.ts: the webhook event types the trigger offers,
 *     with the descriptions from Ramp's webhooks guide
 *
 * Run with `npm run sync:openapi` after Ramp ships API changes.
 */
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SPEC_URL = 'https://docs.ramp.com/openapi/developer-api.json';
const WEBHOOKS_GUIDE_URL = 'https://docs.ramp.com/llms-guides/webhooks.txt';
const API_PREFIX = '/developer/v1';
const METHODS = ['get', 'post', 'put', 'patch', 'delete'];
/** Sent by Ramp during setup only, never a business event to subscribe to. */
const EXCLUDED_EVENTS = new Set(['webhooks.verification', 'tests.test_event']);

function resolver(spec) {
	return (node) => {
		let current = node;
		while (current && typeof current === 'object' && '$ref' in current) {
			current = current.$ref
				.split('/')
				.slice(1)
				.reduce((value, key) => value[key], spec);
		}
		return current;
	};
}

/** Property paths of a schema, across allOf/anyOf/oneOf, with one level of nested objects in dot notation. */
function propertyNames(schema, resolve, prefix = '', depth = 0, seen = new Set()) {
	const resolved = resolve(schema);
	if (!resolved || typeof resolved !== 'object' || seen.has(resolved)) return [];
	seen.add(resolved);
	const names = [];
	for (const [name, child] of Object.entries(resolved.properties ?? {})) {
		names.push(`${prefix}${name}`);
		if (depth === 0) names.push(...propertyNames(child, resolve, `${prefix}${name}.`, depth + 1, new Set(seen)));
	}
	for (const key of ['allOf', 'anyOf', 'oneOf']) {
		for (const branch of resolved[key] ?? []) names.push(...propertyNames(branch, resolve, prefix, depth, seen));
	}
	return names;
}

function describeEndpoints(spec) {
	const resolve = resolver(spec);
	const endpoints = {};
	for (const [path, operations] of Object.entries(spec.paths)) {
		if (!path.startsWith(API_PREFIX)) continue;
		const shortPath = path.slice(API_PREFIX.length);
		for (const method of METHODS) {
			const operation = operations[method];
			if (!operation) continue;
			const parameters = [...(operations.parameters ?? []), ...(operation.parameters ?? [])].map(resolve);
			const query = parameters.filter((parameter) => parameter.in === 'query').map((parameter) => parameter.name);
			const content = resolve(operation.requestBody)?.content ?? {};
			const schema = content['application/json']?.schema ?? content['multipart/form-data']?.schema;
			const body = schema ? propertyNames(schema, resolve) : [];
			endpoints[shortPath] ??= {};
			endpoints[shortPath][method.toUpperCase()] = {
				query: [...new Set(query)].sort(),
				body: [...new Set(body)].sort(),
			};
		}
	}
	return endpoints;
}

function webhookEventTypes(spec) {
	const resolve = resolver(spec);
	const schema = resolve(spec.components.schemas.OutboundWebhookSubscriptionResource);
	return resolve(resolve(schema.properties.event_types).items).enum.filter((event) => !EXCLUDED_EVENTS.has(event));
}

/** Reads `| ... | \`event.type\` | Description |` rows from the webhooks guide. */
function eventDescriptions(guide) {
	const descriptions = {};
	for (const line of guide.split('\n')) {
		const match = line.match(/\|\s*`([a-z_]+\.[a-z_]+)`\s*\|\s*([^|]+?)\s*\|\s*$/);
		// n8n wants no final period on a one-sentence description, and one on longer ones
		if (match) {
			const text = match[2].replace(/`/g, '');
			descriptions[match[1]] = /\.\s/.test(text) ? text : text.replace(/\.$/, '');
		}
	}
	return descriptions;
}

const WORD_OVERRIDES = { po: 'PO' };

function eventName(eventType) {
	return eventType
		.split(/[._]/)
		.map((word) => WORD_OVERRIDES[word] ?? word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}

function escape(text) {
	return text.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

const [spec, guide] = await Promise.all([
	fetch(SPEC_URL).then((response) => response.json()),
	fetch(WEBHOOKS_GUIDE_URL).then((response) => response.text()),
]);

const endpoints = describeEndpoints(spec);
await writeFile(join(ROOT, 'test/fixtures/ramp-paths.json'), `${JSON.stringify(endpoints, null, '\t')}\n`);

const descriptions = eventDescriptions(guide);
const events = webhookEventTypes(spec)
	.map((value) => ({ name: eventName(value), value, description: descriptions[value] }))
	.sort((a, b) => a.name.localeCompare(b.name));

const lines = events.map((event) =>
	[
		'\t{',
		`\t\tname: '${escape(event.name)}',`,
		`\t\tvalue: '${event.value}',`,
		...(event.description ? [`\t\tdescription: '${escape(event.description)}',`] : []),
		'\t},',
	].join('\n'),
);

await writeFile(
	join(ROOT, 'nodes/RampTrigger/events.ts'),
	`import type { INodePropertyOptions } from 'n8n-workflow';

/** Generated by \`npm run sync:openapi\` from Ramp's OpenAPI spec and webhooks guide. Do not edit by hand. */
export const WEBHOOK_EVENT_TYPES: INodePropertyOptions[] = [
${lines.join('\n')}
];
`,
);

console.log(`Wrote ${Object.keys(endpoints).length} paths and ${events.length} webhook event types.`);
