#!/usr/bin/env node
/**
 * Generates nodes/Ramp/resources/generated/*.ts from Ramp's OpenAPI spec and
 * the endpoint list in scripts/endpoints.mjs: one operation per endpoint, with
 * path parameters as record pickers, query parameters as filters or options,
 * flat body fields as form fields and nested body values as JSON fields.
 *
 * Usage: node scripts/generate-resources.mjs [path-to-spec.json]
 * Without a path the live spec is fetched. `npm run generate` also lint-fixes
 * the output.
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENDPOINTS, EXCLUDED_ENDPOINTS, GENERATED_RESOURCES, LIST_SEARCH } from './endpoints.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'nodes/Ramp/resources/generated');
const SPEC_URL = 'https://docs.ramp.com/openapi/developer-api.json';
const API_PREFIX = '/developer/v1';

const specPath = process.argv[2];
const spec = specPath
	? JSON.parse(await readFile(specPath, 'utf8'))
	: await fetch(SPEC_URL).then((response) => response.json());

// ─── Schema helpers ──────────────────────────────────────────────────────────

function resolve(node) {
	let current = node;
	while (current && typeof current === 'object' && '$ref' in current) {
		current = current.$ref
			.split('/')
			.slice(1)
			.reduce((value, key) => value[key], spec);
	}
	return current;
}

/** Flattens allOf and single-branch anyOf/oneOf (often `X | null`) into one schema. */
function flatten(schema) {
	const resolved = resolve(schema) ?? {};
	let merged = { ...resolved };
	for (const branch of resolved.allOf ?? []) {
		const flat = flatten(branch);
		merged = {
			...flat,
			...merged,
			properties: { ...(flat.properties ?? {}), ...(merged.properties ?? {}) },
			required: [...(flat.required ?? []), ...(merged.required ?? [])],
		};
	}
	for (const key of ['anyOf', 'oneOf']) {
		const branches = (resolved[key] ?? []).map(flatten).filter((branch) => branch.type !== 'null');
		if (branches.length === 1) merged = { ...branches[0], ...merged, [key]: undefined };
		else if (branches.length > 1 && branches.every((branch) => ['number', 'integer', 'string'].includes(branch.type))) {
			// Decimal amounts are documented as "string or number"
			merged = { ...merged, type: branches.some((branch) => branch.format === 'decimal') ? 'decimal' : branches[0].type };
		} else if (branches.length > 1) merged = { ...merged, type: 'object' };
	}
	delete merged.allOf;
	if (!merged.properties || Object.keys(merged.properties).length === 0) delete merged.properties;
	return merged;
}

const isBinary = (schema) => schema.format === 'binary' || (schema.type === 'array' && flatten(schema.items).format === 'binary');

/** How a schema maps to an n8n field: a scalar type, or `json` for anything nested. */
function fieldKind(schema) {
	const flat = flatten(schema);
	if (isBinary(flat)) return 'binary';
	if (flat.enum) return 'enum';
	if (flat.type === 'array') {
		const items = flatten(flat.items ?? {});
		if (items.enum) return 'enumList';
		if (items.type === 'string') return 'stringList';
		return 'json';
	}
	if (flat.type === 'boolean') return 'boolean';
	if (flat.type === 'integer' || flat.type === 'number') return 'number';
	if (flat.type === 'decimal') return 'decimal';
	if (flat.type === 'string') return 'string';
	if (flat.properties || flat.type === 'object' || flat.additionalProperties) return 'json';
	return 'string';
}

// ─── Text helpers ────────────────────────────────────────────────────────────

const ACRONYMS = {
	id: 'ID', ids: 'IDs', url: 'URL', urls: 'URLs', api: 'API', gl: 'GL', po: 'PO', erp: 'ERP', ocr: 'OCR',
	ach: 'ACH', mcc: 'MCC', ai: 'AI', uuid: 'UUID', iban: 'IBAN', swift: 'SWIFT', bic: 'BIC', pdf: 'PDF',
	json: 'JSON', sku: 'SKU', ein: 'EIN', tin: 'TIN', us: 'US', usd: 'USD', it: 'IT', sso: 'SSO', w9: 'W-9',
	cvv: 'CVV', pan: 'PAN', iso: 'ISO', vat: 'VAT', sms: 'SMS', http: 'HTTP', https: 'HTTPS', csv: 'CSV',
};
// Words n8n's title-case lint keeps lowercase
const SMALL_WORDS = new Set(['a', 'an', 'and', 'for', 'in', 'of', 'or', 'the', 'to', 'via', 'with']);

function words(name) {
	return name
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.split(/[\s_.-]+/)
		.filter(Boolean);
}

function titleCase(name) {
	return words(name)
		.map((word, index) => {
			const lower = word.toLowerCase();
			if (ACRONYMS[lower]) return ACRONYMS[lower];
			if (index > 0 && SMALL_WORDS.has(lower)) return lower;
			// Capitalise the first letter even behind punctuation, as in "(Audit)"
			return lower.replace(/[a-z]/, (letter) => letter.toUpperCase());
		})
		.join(' ');
}

/** Parameter names n8n reads in a special way, so generated fields never use them. */
const RESERVED_NAMES = { action: 'actionType', operation: 'operationType', resource: 'resourceType' };

function camelCase(name) {
	const parts = words(name).map((word) => word.toLowerCase());
	const joined = parts.map((part, index) => (index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1))).join('');
	return RESERVED_NAMES[joined] ?? joined;
}

function optionLabel(value) {
	return titleCase(String(value).replace(/\s+/g, ' '));
}

/** n8n's description rules: capital first letter, a final period only on multi-sentence text. */
function finalize(text) {
	let clean = String(text ?? '').replace(/\s+/g, ' ').trim();
	if (!clean) return '';
	clean = clean.charAt(0).toUpperCase() + clean.slice(1);
	const sentences = clean.replace(/\b(e\.g|i\.e|etc)\./gi, '$1').split(/[.!?]\s+\S/).length;
	if (sentences > 1 && !/[.!?…]$/.test(clean)) clean += '.';
	if (sentences === 1) clean = clean.replace(/\.$/, '');
	return clean;
}

/** Spec prose cleaned for n8n: no markdown, IDs capitalised, n8n's final-period rule applied. */
function cleanDescription(text, { maxLength = 320 } = {}) {
	if (!text) return '';
	let clean = String(text)
		.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
		.replace(/`([^`]*)`/g, '$1')
		.replace(/\*\*([^*]+)\*\*/g, '$1')
		.replace(/(^|\s)\*([^*\s][^*]*)\*(?=\s|$|[.,;:])/g, '$1$2')
		.replace(/^#+\s*/gm, '')
		.replace(/(^|\s)[-*]\s+(?=\S)/g, '$1')
		.replace(/<[^>]+>/g, ' ')
		.replace(/[<>]/g, (char) => (char === '<' ? 'less than ' : 'more than '))
		.replace(/\s+/g, ' ')
		.trim();
	clean = clean.replace(/\b(id|ids|url|urls|api|json|uuid|gl|erp|ocr|pdf)\b/gi, (match) => ACRONYMS[match.toLowerCase()] ?? match);
	// Ramp's spec has the odd "a issued_at"
	clean = clean.replace(/\b([Aa]) (?=[aeio])/g, '$1n ');
	if (clean.length > maxLength) {
		const cut = clean.slice(0, maxLength);
		const lastStop = cut.lastIndexOf('. ');
		clean = lastStop > 60 ? cut.slice(0, lastStop + 1) : `${cut.replace(/\s+\S*$/, '')}…`;
	}
	// Status notes like "Action to perform: ..." add nothing under a field name
	if (/^(the )?(\w+ )?(action|operation) to perform\b/i.test(clean)) {
		clean = clean.replace(/^[^.:]*[.:]\s*/, '');
		if (/^(the )?(\w+ )?(action|operation) to perform\b/i.test(clean)) return '';
	}
	return finalize(clean);
}

const IMPERATIVE = /^(filter|include|show|hide|return|only|set|use|send|enable|disable|allow|require|mark|create|apply|request|exclude|skip|convert|automatically|sort|list|fetch|get|limit|restrict|override|notify|enforce|hold|sync|treat)\b/i;

/** n8n wants boolean descriptions to start with "Whether". */
function booleanDescription(text, displayName) {
	const clean = cleanDescription(text);
	if (/^whether\b/i.test(clean)) return clean.charAt(0).toUpperCase() + clean.slice(1);
	if (!clean) return `Whether to set ${displayName.toLowerCase()}`;
	const lowered = clean.charAt(0).toLowerCase() + clean.slice(1);
	if (/^(if|when)\b/i.test(clean)) return `Whether to set this. ${clean.charAt(0).toUpperCase()}${clean.slice(1)}${/[.!?]$/.test(clean) ? '' : '.'}`;
	return finalize(IMPERATIVE.test(clean) ? `Whether to ${lowered}` : `Whether ${lowered}`);
}

// ─── Code emission ───────────────────────────────────────────────────────────

/** Marks a string as code, so `emit` writes it unquoted. */
const code = (text) => ({ __code: text });

function emit(value, indent = '') {
	const next = `${indent}\t`;
	if (value && typeof value === 'object' && '__code' in value) return value.__code;
	if (Array.isArray(value)) {
		if (value.length === 0) return '[]';
		return `[\n${value.map((entry) => `${next}${emit(entry, next)},`).join('\n')}\n${indent}]`;
	}
	if (value && typeof value === 'object') {
		const entries = Object.entries(value).filter(([, entry]) => entry !== undefined);
		if (entries.length === 0) return '{}';
		return `{\n${entries
			.map(([key, entry]) => `${next}${/^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key)}: ${emit(entry, next)},`)
			.join('\n')}\n${indent}}`;
	}
	if (typeof value === 'string') return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
	return JSON.stringify(value);
}

const quote = (text) => `'${String(text).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

// ─── Field builders ──────────────────────────────────────────────────────────

/** One n8n field for a scalar schema, without routing. */
function scalarField({ name, apiName, schema, required, description }) {
	const flat = flatten(schema);
	const kind = fieldKind(flat);
	const displayName = titleCase(apiName);
	const field = { displayName, name, type: 'string', default: '' };
	if (required) field.required = true;

	switch (kind) {
		case 'boolean':
			field.type = 'boolean';
			field.default = typeof flat.default === 'boolean' ? flat.default : false;
			field.description = booleanDescription(description ?? flat.description, displayName);
			return field;
		case 'number':
			field.type = 'number';
			field.default = typeof flat.default === 'number' ? flat.default : 0;
			break;
		case 'decimal':
			field.placeholder = 'e.g. 1250.00';
			break;
		case 'enum': {
			const options = [...new Set(flat.enum.filter((value) => value !== null))]
				.map((value) => ({ name: optionLabel(value), value }))
				.sort((a, b) => a.name.localeCompare(b.name));
			field.type = 'options';
			field.options = options;
			field.default = flat.enum.includes(flat.default) ? flat.default : options[0]?.value ?? '';
			break;
		}
		case 'enumList': {
			const items = flatten(flat.items);
			field.type = 'multiOptions';
			field.options = [...new Set(items.enum.filter((value) => value !== null))]
				.map((value) => ({ name: optionLabel(value), value }))
				.sort((a, b) => a.name.localeCompare(b.name));
			field.default = [];
			break;
		}
		case 'stringList':
			field.placeholder = 'e.g. value1, value2';
			break;
		case 'string':
			if (flat.format === 'date-time') field.type = 'dateTime';
			else if (flat.format === 'date') field.placeholder = 'e.g. 2026-11-30';
			else if (flat.format === 'email') field.placeholder = 'name@email.com';
			else if (flat.format === 'uuid') field.placeholder = 'e.g. 3aa9eed1-c793-4b52-a502-e7f2a7e4c1b2';
			break;
		default:
			break;
	}
	let text = cleanDescription(description ?? flat.description);
	if (kind === 'stringList') text = [text, 'Comma-separated'].filter(Boolean).join(text && !/[.!?…]$/.test(text) ? '. ' : ' ');
	if (flat.format === 'date' && !/YYYY/.test(text)) text = text ? `${text}${/[.!?…]$/.test(text) ? '' : '.'} Format YYYY-MM-DD.` : 'Format YYYY-MM-DD';
	text = finalize(text);
	if (text && text.toLowerCase() !== displayName.toLowerCase()) field.description = text;
	if (field.type === 'string' && /email/i.test(apiName) && !field.placeholder) field.placeholder = 'name@email.com';
	return field;
}

function queryRouting(field, apiName) {
	const value =
		field.type === 'multiOptions'
			? '={{ Array.isArray($value) && $value.length > 0 ? $value.join(",") : undefined }}'
			: '={{ $value === "" ? undefined : $value }}';
	return { ...field, routing: { send: { type: 'query', property: apiName, value } } };
}

function bodyRouting(field, apiName, kind) {
	if (kind === 'stringList') {
		return { ...field, routing: { send: { preSend: [code(`setListBodyValue(${quote(field.name)}, ${quote(apiName)})`)] } } };
	}
	const send = { type: 'body', property: apiName, propertyInDotNotation: false };
	if (kind === 'decimal') send.value = '={{ $value === "" ? undefined : $value }}';
	return { ...field, routing: { send } };
}

const byDisplayName = (a, b) => a.displayName.localeCompare(b.displayName);

// ─── Per-endpoint generation ─────────────────────────────────────────────────

const SKIPPED_QUERY = new Set(['start', 'page_size']);

/** Path parameter → node parameter name: `draft_bill_id` → `draftBill`. */
function pathParameterName(apiName) {
	return camelCase(apiName.replace(/_id$/, '').replace(/_uuid$/, ''));
}

function operationValue(name) {
	return name === 'Get Many' ? 'getAll' : camelCase(name);
}

function describeEndpoint([method, path, resource, name]) {
	const specOperation = spec.paths[`${API_PREFIX}${path}`]?.[method.toLowerCase()];
	if (!specOperation) throw new Error(`${method} ${path} is not in the Ramp spec`);
	const pathItem = spec.paths[`${API_PREFIX}${path}`];
	const parameters = [...(pathItem.parameters ?? []), ...(specOperation.parameters ?? [])].map(resolve);
	const requestBody = resolve(specOperation.requestBody);
	const contentTypes = Object.keys(requestBody?.content ?? {});
	const bodyContentType = contentTypes.find((type) => type === 'application/json') ?? contentTypes.find((type) => type === 'multipart/form-data');
	const bodySchema = bodyContentType ? flatten(requestBody.content[bodyContentType].schema) : undefined;
	const success = specOperation.responses['200'] ?? specOperation.responses['201'] ?? specOperation.responses['204'];
	const responseTypes = Object.keys(resolve(success)?.content ?? {});
	const responseSchema = responseTypes.includes('application/json')
		? flatten(resolve(success).content['application/json'].schema)
		: undefined;

	const queryNames = new Set(parameters.filter((parameter) => parameter.in === 'query').map((parameter) => parameter.name));
	const bodyNames = new Set(Object.keys(bodySchema?.properties ?? {}));
	const responseProperties = new Set(Object.keys(responseSchema?.properties ?? {}));
	const pagedResponse = responseProperties.has('page') && responseProperties.has('data');

	let output = 'record';
	let pageIn;
	if (responseTypes.some((type) => type === 'application/pdf' || type === 'application/octet-stream')) output = 'binary';
	else if (pagedResponse || (method === 'GET' && queryNames.has('page_size'))) {
		output = 'list';
		if (queryNames.has('page_size')) pageIn = 'query';
		else if (bodyNames.has('page_size')) pageIn = 'body';
		else pageIn = 'none';
	} else if (method === 'DELETE' || responseTypes.length === 0) output = 'success';

	return {
		method,
		path,
		resource,
		name,
		value: operationValue(name),
		specOperation,
		parameters,
		bodySchema,
		bodyContentType,
		output,
		pageIn,
	};
}

function generateResource(resource, endpoints) {
	const operations = [];
	const properties = [];
	const pathLocators = new Map();

	for (const endpoint of endpoints) {
		const { method, path, value, name, specOperation, parameters, bodySchema, bodyContentType, output, pageIn } = endpoint;
		const show = { show: { resource: [resource], operation: [value] } };
		const opProperties = [];
		const usedNames = new Set();
		const uniqueName = (candidate) => {
			let unique = candidate;
			for (let index = 2; usedNames.has(unique); index++) unique = `${candidate}${index}`;
			usedNames.add(unique);
			return unique;
		};

		// Path parameters become record pickers shared across the resource's operations
		let url = path;
		for (const parameter of parameters.filter((entry) => entry.in === 'path')) {
			const paramName = pathParameterName(parameter.name);
			usedNames.add(paramName);
			url = url.replace(`{${parameter.name}}`, `{{$parameter.${paramName}}}`);
			const schema = flatten(parameter.schema ?? {});
			const key = paramName;
			if (!pathLocators.has(key)) {
				const displayName = titleCase(parameter.name.replace(/_id$/, '').replace(/_uuid$/, ''));
				const isRecord = /_(id|uuid)$/.test(parameter.name);
				pathLocators.set(key, {
					operations: [],
					property: schema.enum
						? scalarField({ name: paramName, apiName: parameter.name, schema, required: true, description: parameter.description })
						: isRecord
							? {
									__locator: true,
									name: paramName,
									displayName,
									searchListMethod: LIST_SEARCH[paramName],
									description: cleanDescription(parameter.description) || undefined,
								}
							: {
									displayName,
									name: paramName,
									type: 'string',
									default: '',
									required: true,
									description: cleanDescription(parameter.description) || undefined,
								},
				});
			}
			pathLocators.get(key).operations.push(value);
		}

		// Header parameters: only X-Idempotency-Key exists today
		for (const parameter of parameters.filter((entry) => entry.in === 'header')) {
			if (parameter.name.toLowerCase() !== 'x-idempotency-key') continue;
			const fieldName = uniqueName('idempotencyKey');
			opProperties.push({
				displayName: 'Idempotency Key',
				name: fieldName,
				type: 'string',
				default: '',
				description:
					'Ramp ignores a repeat request with the same key. Leave empty for a new key per item, or set one from your own data so a re-run cannot repeat the action.',
				displayOptions: show,
				routing: { send: { preSend: [code(`setIdempotencyHeader(${quote(fieldName)})`)] } },
			});
		}

		// Query parameters
		const queryParameters = parameters.filter((entry) => entry.in === 'query' && !SKIPPED_QUERY.has(entry.name));
		if (output === 'list') opProperties.push(...['paginationProperties']);
		const requiredQuery = queryParameters.filter((entry) => entry.required);
		const optionalQuery = queryParameters.filter((entry) => !entry.required);
		for (const parameter of requiredQuery) {
			const field = scalarField({
				name: uniqueName(camelCase(parameter.name)),
				apiName: parameter.name,
				schema: parameter.schema ?? {},
				required: true,
				description: parameter.description,
			});
			opProperties.push({ ...queryRouting(field, parameter.name), displayOptions: show });
		}
		if (optionalQuery.length > 0) {
			const collectionName = uniqueName(output === 'list' ? 'filters' : 'options');
			opProperties.push({
				displayName: output === 'list' ? 'Filters' : 'Options',
				name: collectionName,
				type: 'collection',
				placeholder: output === 'list' ? 'Add Filter' : 'Add Option',
				default: {},
				displayOptions: show,
				options: optionalQuery
					.map((parameter) =>
						queryRouting(
							scalarField({
								name: camelCase(parameter.name),
								apiName: parameter.name,
								schema: parameter.schema ?? {},
								required: false,
								description: parameter.description,
							}),
							parameter.name,
						),
					)
					.sort(byDisplayName),
			});
		}

		// Body
		const preSendLast = [];
		if (bodySchema) {
			const isMultipart = bodyContentType === 'multipart/form-data';
			const required = new Set(bodySchema.required ?? []);
			const entries = Object.entries(bodySchema.properties ?? {}).filter(([apiName]) => !(pageIn === 'body' && SKIPPED_QUERY.has(apiName)));
			const files = [];
			const optionalScalars = [];
			let hasOptionalNested = false;
			let needsIdempotencyKey = false;

			for (const [apiName, schema] of entries) {
				const flat = flatten(schema);
				const kind = fieldKind(flat);
				const description = flat.description;
				if (kind === 'binary') {
					files.push({ apiName, flat });
					continue;
				}
				if (apiName === 'idempotency_key') {
					needsIdempotencyKey = true;
					optionalScalars.push({ apiName, schema: flat, description: 'Ramp ignores a repeat request with the same key. Leave empty for a new key per item, or set one from your own data so a re-run cannot repeat the action.' });
					continue;
				}
				if (kind === 'json') {
					if (required.has(apiName)) {
						const fieldName = uniqueName(`${camelCase(apiName)}Json`);
						const isArray = flat.type === 'array';
						const label = `${titleCase(apiName)} (JSON)`;
						opProperties.push({
							displayName: label,
							name: fieldName,
							type: 'json',
							default: isArray ? '[]' : '{}',
							required: true,
							description: finalize(
								[cleanDescription(description), 'Field names follow the Ramp API reference']
									.filter(Boolean)
									.map((text) => (/[.!?…]$/.test(text) ? text : `${text}.`))
									.join(' '),
							),
							displayOptions: show,
							routing: {
								send: {
									preSend: [code(`setJsonBodyValue(${quote(fieldName)}, ${quote(apiName)}, ${quote(label)}, ${quote(isArray ? 'array' : 'object')})`)],
								},
							},
						});
					} else hasOptionalNested = true;
					continue;
				}
				if (required.has(apiName)) {
					const field = scalarField({ name: uniqueName(camelCase(apiName)), apiName, schema: flat, required: true, description });
					opProperties.push({ ...bodyRouting(field, apiName, kind), displayOptions: show });
				} else optionalScalars.push({ apiName, schema: flat, description });
			}

			if (optionalScalars.length > 0) {
				const collectionName = uniqueName('additionalFields');
				opProperties.push({
					displayName: 'Additional Fields',
					name: collectionName,
					type: 'collection',
					placeholder: 'Add Field',
					default: {},
					displayOptions: show,
					options: optionalScalars
						.map(({ apiName, schema, description }) =>
							bodyRouting(
								scalarField({ name: camelCase(apiName), apiName, schema, required: false, description }),
								apiName,
								fieldKind(schema),
							),
						)
						.sort(byDisplayName),
				});
			}

			if (needsIdempotencyKey) {
				const last = opProperties.at(-1);
				last.routing = { ...(last.routing ?? {}), send: { ...(last.routing?.send ?? {}), preSend: [...(last.routing?.send?.preSend ?? []), code('ensureIdempotencyKey')] } };
			}

			const freeForm = !bodySchema.properties && (bodySchema.type === 'object' || bodySchema.additionalProperties);
			if (hasOptionalNested || freeForm) {
				const fieldName = uniqueName('jsonBody');
				opProperties.push({
					displayName: freeForm ? 'Body (JSON)' : 'Additional Body Fields (JSON)',
					name: fieldName,
					type: 'json',
					default: '{}',
					description: freeForm
						? 'The request body as JSON. Field names follow the Ramp API reference.'
						: `Nested fields as JSON, such as ${entries
								.filter(([apiName, schema]) => !required.has(apiName) && fieldKind(schema) === 'json')
								.slice(0, 3)
								.map(([apiName]) => apiName)
								.join(', ')}. Field names follow the Ramp API reference. Form fields win over the same key.`,
					displayOptions: show,
					routing: {
						send: {
							preSend: [code(`mergeJsonBody(${quote(fieldName)}, ${quote(freeForm ? 'Body (JSON)' : 'Additional Body Fields (JSON)')})`)],
						},
					},
				});
			}

			if (isMultipart) {
				const fileParts = files.map(({ apiName, flat }) => {
					const fieldName = uniqueName(`${camelCase(apiName)}BinaryPropertyName`);
					const several = flat.type === 'array';
					opProperties.push({
						displayName: `Input Binary Field${several ? 's' : ''} (${titleCase(apiName)})`,
						name: fieldName,
						type: 'string',
						default: 'data',
						required: (bodySchema.required ?? []).includes(apiName) || !several ? true : undefined,
						hint: several
							? 'Names of the input binary fields holding the files, comma-separated'
							: 'The name of the input binary field holding the file to upload',
						displayOptions: show,
					});
					return `{ field: ${quote(apiName)}, parameter: ${quote(fieldName)} }`;
				});
				preSendLast.push(code(`toMultipartBody([${fileParts.join(', ')}])`));
			}
		}

		if (output === 'binary') {
			opProperties.push({
				displayName: 'Put Output File in Field',
				name: uniqueName('binaryPropertyName'),
				type: 'string',
				default: 'data',
				required: true,
				hint: 'The name of the output binary field to put the file in',
				displayOptions: show,
			});
		}

		// The multipart encoder must run after every other preSend has filled the body,
		// and preSend functions run in property order, so it rides on the last field
		if (preSendLast.length > 0) {
			const last = opProperties.at(-1);
			last.routing = { ...(last.routing ?? {}), send: { ...(last.routing?.send ?? {}), preSend: [...(last.routing?.send?.preSend ?? []), ...preSendLast] } };
		}

		properties.push(...opProperties.map((property) => (property === 'paginationProperties' ? code(`...paginationProperties(${emit(show, '\t')})`) : property)));

		const settings =
			output === 'record'
				? undefined
				: output === 'list' && pageIn !== 'query'
					? { output, pageIn: pageIn ?? 'none' }
					: output === 'binary'
						? { output, fileName: camelCase(name.replace(/^Download /, '')).replace(/([A-Z])/g, '-$1').toLowerCase() }
						: output;
		const summary = cleanDescription(specOperation.summary ?? name, { maxLength: 200 });
		// The first sentence of the spec description, unless it is a status note rather than a description
		const firstSentence = cleanDescription(specOperation.description ?? '', { maxLength: 400 }).split(/(?<=\.)\s+(?=[A-Z])/)[0] ?? '';
		const description = firstSentence && !/^(note|early access|this endpoint|requires|deprecated|beta|alpha)\b/i.test(firstSentence) && firstSentence.length <= 200
			? firstSentence.replace(/\.$/, '')
			: summary;
		operations.push({
			name,
			value,
			action: summary.charAt(0).toUpperCase() + summary.slice(1),
			description,
			method,
			url: url.includes('{{') ? `=${url}` : url,
			output: settings,
		});
	}

	const locatorProperties = [...pathLocators.values()].map(({ operations: ops, property }) => {
		const show = { show: { resource: [resource], operation: ops } };
		if (property.__locator) {
			return code(
				`recordLocator(${emit(
					{
						name: property.name,
						displayName: property.displayName,
						searchListMethod: property.searchListMethod,
						searchable: property.searchListMethod ? true : undefined,
						description: property.description,
						displayOptions: show,
					},
					'\t',
				)})`,
			);
		}
		return { ...property, displayOptions: show };
	});

	return { operations: operations.sort((a, b) => a.name.localeCompare(b.name)), properties: [...locatorProperties, ...properties] };
}

// ─── Files ───────────────────────────────────────────────────────────────────

function emitOperation(operation) {
	const fields = {
		name: operation.name,
		value: operation.value,
		action: operation.action,
		description: operation.description,
		method: operation.method,
		url: operation.url,
	};
	if (operation.output !== undefined) {
		fields.output = typeof operation.output === 'string' ? operation.output : code(emit(operation.output, '\t\t'));
	}
	return code(`operation(${emit(fields, '\t')})`);
}

function resourceFile(resource, { operations, properties }) {
	const exportName = camelCase(resource);
	const body = emit(properties, '');
	const sharedImports = ['paginationProperties', 'recordLocator'].filter((name) => body.includes(`${name}(`));
	const preSendImports = ['ensureIdempotencyKey', 'mergeJsonBody', 'setIdempotencyHeader', 'setJsonBodyValue', 'setListBodyValue', 'toMultipartBody'].filter((name) =>
		new RegExp(`\\b${name}\\b`).test(body),
	);
	const isGeneratedResource = resource in GENERATED_RESOURCES;
	const defaultOperation = operations.some((operation) => operation.value === 'getAll') ? 'getAll' : operations[0].value;
	const lines = [
		"// Generated by `npm run generate` from Ramp's OpenAPI spec and scripts/endpoints.mjs. Do not edit by hand.",
		`import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';`,
		sharedImports.length > 0 ? `import { ${sharedImports.join(', ')} } from '../../shared/descriptions';` : undefined,
		`import { operation${isGeneratedResource ? ', operationSelector' : ''} } from '../../shared/operations';`,
		preSendImports.length > 0 ? `import { ${preSendImports.join(', ')} } from '../../shared/preSend';` : undefined,
		'',
		`export const ${exportName}GeneratedOperations: INodePropertyOptions[] = ${emit(operations.map(emitOperation), '')};`,
		'',
		`export const ${exportName}GeneratedProperties: INodeProperties[] = ${body};`,
	];
	if (isGeneratedResource) {
		lines.push(
			'',
			`export const ${exportName}Description: INodeProperties[] = [`,
			`\toperationSelector(${quote(resource)}, ${exportName}GeneratedOperations, ${quote(defaultOperation)}),`,
			`\t...${exportName}GeneratedProperties,`,
			'];',
		);
	}
	return `${lines.filter((line) => line !== undefined).join('\n')}\n`;
}

// ─── Run ─────────────────────────────────────────────────────────────────────

const seen = new Set();
for (const [method, path] of ENDPOINTS) {
	const key = `${method} ${path}`;
	if (seen.has(key)) throw new Error(`${key} is listed twice`);
	if (EXCLUDED_ENDPOINTS[key]) throw new Error(`${key} is both listed and excluded`);
	seen.add(key);
}

const byResource = new Map();
for (const endpoint of ENDPOINTS.map(describeEndpoint)) {
	if (!byResource.has(endpoint.resource)) byResource.set(endpoint.resource, []);
	byResource.get(endpoint.resource).push(endpoint);
}

await rm(OUT_DIR, { recursive: true, force: true });
await mkdir(OUT_DIR, { recursive: true });
for (const [resource, endpoints] of byResource) {
	const values = new Set();
	for (const endpoint of endpoints) {
		if (values.has(endpoint.value)) throw new Error(`${resource}.${endpoint.value} is generated twice`);
		values.add(endpoint.value);
	}
	await writeFile(join(OUT_DIR, `${resource}.ts`), resourceFile(resource, generateResource(resource, endpoints)));
}

const generated = Object.keys(GENERATED_RESOURCES).sort();
const index = [
	"// Generated by `npm run generate`. Do not edit by hand.",
	`import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';`,
	...generated.map((resource) => `import { ${camelCase(resource)}Description } from './${resource}';`),
	'',
	'/** Resources that exist only as generated code, for the Resource dropdown. */',
	`export const GENERATED_RESOURCE_OPTIONS: INodePropertyOptions[] = ${emit(
		generated.map((resource) => ({ name: GENERATED_RESOURCES[resource], value: resource })),
		'',
	)};`,
	'',
	`export const generatedDescriptions: INodeProperties[] = [`,
	...generated.map((resource) => `\t...${camelCase(resource)}Description,`),
	'];',
	'',
].join('\n');
await writeFile(join(OUT_DIR, 'index.ts'), index);

console.log(`Generated ${ENDPOINTS.length} operations in ${byResource.size} resources.`);
