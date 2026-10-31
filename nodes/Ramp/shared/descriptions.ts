import type { IDisplayOptions, INodeProperties } from 'n8n-workflow';
import { mergeJsonBody } from './preSend';

const UUID_PLACEHOLDER = 'e.g. 3aa9eed1-c793-4b52-a502-e7f2a7e4c1b2';

type LocatorOptions = {
	name: string;
	displayName: string;
	displayOptions: IDisplayOptions;
	/** Omit for records Ramp offers no useful list for; the picker is then ID only. */
	searchListMethod?: string;
	searchable?: boolean;
	description?: string;
	required?: boolean;
};

/** "From List" or "By ID" picker for a Ramp record. Ramp IDs are UUIDs. */
export function recordLocator({
	name,
	displayName,
	displayOptions,
	searchListMethod,
	searchable = false,
	description,
	required = true,
}: LocatorOptions): INodeProperties {
	const locator: INodeProperties = {
		displayName,
		name,
		type: 'resourceLocator',
		default: { mode: searchListMethod ? 'list' : 'id', value: '' },
		required,
		description: description ?? `The ${displayName.toLowerCase()} to work with`,
		displayOptions,
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				placeholder: `Select a ${displayName.toLowerCase()}...`,
				typeOptions: { searchListMethod, searchable },
			},
			{
				displayName: 'By ID',
				name: 'id',
				type: 'string',
				placeholder: UUID_PLACEHOLDER,
			},
		],
	};
	// Records without a useful list endpoint are picked by ID only
	if (!searchListMethod) locator.modes = locator.modes?.filter((mode) => mode.name === 'id');
	return locator;
}

/** "Return All" and "Limit" for a list endpoint. `sendRampRequest` reads both and pages through `page.next`. */
export function paginationProperties(displayOptions: IDisplayOptions): INodeProperties[] {
	return [
		{
			displayName: 'Return All',
			name: 'returnAll',
			type: 'boolean',
			default: false,
			description: 'Whether to return all results or only up to a given limit',
			displayOptions,
		},
		{
			displayName: 'Limit',
			name: 'limit',
			type: 'number',
			default: 50,
			description: 'Max number of results to return',
			typeOptions: {
				minValue: 1,
			},
			displayOptions: {
				...displayOptions,
				show: {
					...displayOptions.show,
					returnAll: [false],
				},
			},
		},
	];
}

/** Free-form JSON merged into the request body, for nested structures the form does not cover. */
export function jsonBodyProperty(
	displayOptions: IDisplayOptions,
	description: string,
	placeholder: string,
	displayName = 'Additional Body Fields (JSON)',
): INodeProperties {
	return {
		displayName,
		name: 'jsonBody',
		type: 'json',
		default: '{}',
		placeholder,
		description,
		displayOptions,
		routing: {
			send: {
				preSend: [mergeJsonBody('jsonBody', displayName)],
			},
		},
	};
}

/** A "Filters" collection entry that sends one query parameter. */
export function queryOption(option: Omit<INodeProperties, 'routing'>, property = option.name): INodeProperties {
	return {
		...option,
		routing: {
			send: {
				type: 'query',
				property,
				value: '={{ $value === "" ? undefined : $value }}',
			},
		},
	};
}

/** Query entry for a multi-select filter, which Ramp expects as one comma-separated value. */
export function listQueryOption(option: Omit<INodeProperties, 'routing'>, property = option.name): INodeProperties {
	return {
		...option,
		routing: {
			send: {
				type: 'query',
				property,
				value: '={{ Array.isArray($value) && $value.length > 0 ? $value.join(",") : undefined }}',
			},
		},
	};
}

/** A collection entry or field that sends one body property. */
export function bodyOption(option: Omit<INodeProperties, 'routing'>, property = option.name): INodeProperties {
	return {
		...option,
		routing: {
			send: {
				type: 'body',
				property,
			},
		},
	};
}

/** A required top-level field sent as one body property. */
export function bodyField(
	option: Omit<INodeProperties, 'routing' | 'displayOptions'>,
	displayOptions: IDisplayOptions,
	property = option.name,
): INodeProperties {
	return bodyOption({ ...option, displayOptions }, property);
}

/** A record picker sent as one body property, such as `vendor_id`. */
export function bodyLocator(locator: INodeProperties, property: string): INodeProperties {
	return {
		...locator,
		routing: {
			send: {
				type: 'body',
				property,
			},
		},
	};
}

/** Keeps collection entries in the alphabetical order n8n expects. */
export function byDisplayName(a: INodeProperties, b: INodeProperties): number {
	return a.displayName.localeCompare(b.displayName);
}

/** Date-time filter entry with the ISO 8601 hint Ramp needs. */
export function dateQueryOption(displayName: string, name: string, property: string, description: string): INodeProperties {
	return queryOption({ displayName, name, type: 'dateTime', default: '', description }, property);
}

