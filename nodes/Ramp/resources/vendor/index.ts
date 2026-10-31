import type { INodeProperties } from 'n8n-workflow';
import {
	bodyField,
	bodyOption,
	byDisplayName,
	dateQueryOption,
	jsonBodyProperty,
	paginationProperties,
	queryOption,
	recordLocator,
} from '../../shared/descriptions';
import { operation, operationSelector } from '../../shared/operations';

const RESOURCE = 'vendor';

const show = (operations: string[]) => ({ show: { resource: [RESOURCE], operation: operations } });

/** Fields Create and Update share. */
const sharedBodyOptions = (): INodeProperties[] => [
	bodyOption(
		{
			displayName: 'Accounting Vendor Remote ID',
			name: 'accountingVendorRemoteId',
			type: 'string',
			default: '',
			description: 'ID of the matching vendor in the ERP, to link the two',
		},
		'accounting_vendor_remote_id',
	),
	bodyOption(
		{
			displayName: 'Country',
			name: 'country',
			type: 'string',
			default: '',
			placeholder: 'e.g. DE',
			description: 'Two-letter country code. Ramp assumes US when it is not set.',
		},
		'country',
	),
	bodyOption(
		{
			displayName: 'Default Entity ID',
			name: 'defaultEntityId',
			type: 'string',
			default: '',
			description: 'Business entity the vendor is billed to by default',
		},
		'default_entity_id',
	),
	bodyOption(
		{
			displayName: 'External Vendor ID',
			name: 'externalVendorId',
			type: 'string',
			default: '',
			description: 'Your own ID for the vendor, independent of the ERP',
		},
		'external_vendor_id',
	),
	bodyOption(
		{
			displayName: 'Net Payment Terms (Days)',
			name: 'netPaymentTerms',
			type: 'number',
			default: 30,
			description: 'Days after receipt the payment is due. 0 is due on receipt.',
		},
		'net_payment_terms',
	),
	bodyOption(
		{
			displayName: 'Request Payment Details',
			name: 'requestPaymentDetails',
			type: 'boolean',
			default: false,
			description: 'Whether Ramp asks the vendor for bank details by email',
		},
		'request_payment_details',
	),
	bodyOption(
		{
			displayName: 'Request Tax Details',
			name: 'requestTaxDetails',
			type: 'boolean',
			default: false,
			description: 'Whether Ramp asks the vendor for tax information, such as a W-9, by email',
		},
		'request_tax_details',
	),
	bodyOption(
		{
			displayName: 'State',
			name: 'state',
			type: 'string',
			default: '',
			placeholder: 'e.g. NY',
			description: 'Two-letter US state code. Ignored for vendors outside the US.',
		},
		'state',
	),
];

export const vendorDescription: INodeProperties[] = [
	operationSelector(
		RESOURCE,
		[
			operation({
				name: 'Create',
				value: 'create',
				action: 'Create a vendor',
				description:
					'Create a vendor. Vendors created through the API are approved right away, without the vendor approval policy.',
				method: 'POST',
				url: '/vendors',
			}),
			operation({
				name: 'Delete',
				value: 'delete',
				action: 'Delete a vendor',
				description: 'Delete a vendor that has no transactions, bills, contracts, requests or child vendors',
				method: 'DELETE',
				url: '=/vendors/{{$parameter.vendor}}',
				output: 'success',
			}),
			operation({
				name: 'Get',
				value: 'get',
				action: 'Get a vendor',
				description: 'Get a vendor',
				method: 'GET',
				url: '=/vendors/{{$parameter.vendor}}',
			}),
			operation({
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many vendors',
				description: 'List vendors',
				method: 'GET',
				url: '/vendors',
				output: 'list',
			}),
			operation({
				name: 'Update',
				value: 'update',
				action: 'Update a vendor',
				description: 'Update a vendor',
				method: 'PATCH',
				url: '=/vendors/{{$parameter.vendor}}',
			}),
		],
		'getAll',
	),
	recordLocator({
		name: 'vendor',
		displayName: 'Vendor',
		searchListMethod: 'getVendors',
		searchable: true,
		displayOptions: show(['delete', 'get', 'update']),
	}),

	// Create
	{
		displayName:
			'Ramp does not deduplicate vendors. Check with Get Many (filter by name or external vendor ID) before creating one.',
		name: 'duplicateNotice',
		type: 'notice',
		default: '',
		displayOptions: show(['create']),
	},
	bodyField({ displayName: 'Name', name: 'name', type: 'string', default: '', required: true }, show(['create'])),
	bodyField(
		{
			displayName: 'Contact Email',
			name: 'contactEmail',
			type: 'string',
			placeholder: 'name@email.com',
			default: '',
			required: true,
			description: 'Email of the person at the vendor who receives payment notices and requests',
		},
		show(['create']),
		'business_vendor_contacts.email',
	),
	{
		displayName: 'Additional Fields',
		name: 'createFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: show(['create']),
		options: [
			...sharedBodyOptions(),
			bodyOption({ displayName: 'Contact First Name', name: 'contactFirstName', type: 'string', default: '' }, 'business_vendor_contacts.first_name'),
			bodyOption({ displayName: 'Contact Last Name', name: 'contactLastName', type: 'string', default: '' }, 'business_vendor_contacts.last_name'),
			bodyOption({ displayName: 'Contact Phone', name: 'contactPhone', type: 'string', default: '' }, 'business_vendor_contacts.phone'),
			bodyOption({ displayName: 'Parent Vendor ID', name: 'parentVendorId', type: 'string', default: '' }, 'parent_vendor_id'),
			bodyOption(
				{
					displayName: 'Vendor Owner ID',
					name: 'vendorOwnerId',
					type: 'string',
					default: '',
					description: 'User who owns the vendor relationship',
				},
				'vendor_owner_id',
			),
		].sort(byDisplayName),
	},
	jsonBodyProperty(
		show(['create']),
		'Other body fields as JSON, such as address. Field names follow the Ramp API reference. Form fields win over the same key.',
		'{"address": {"address_line_1": "Novalisstraße 10", "city": "Berlin", "postal_code": "10115", "country": "DE"}}',
	),

	// Update
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: show(['update']),
		options: [
			...sharedBodyOptions(),
			bodyOption({ displayName: 'Name', name: 'name', type: 'string', default: '' }, 'name'),
			bodyOption({ displayName: 'Display Name', name: 'displayName', type: 'string', default: '' }, 'display_name'),
			bodyOption({ displayName: 'Description', name: 'description', type: 'string', default: '' }, 'description'),
			bodyOption(
				{
					displayName: 'Active',
					name: 'isActive',
					type: 'boolean',
					default: true,
					description: 'Whether the vendor is active',
				},
				'is_active',
			),
			bodyOption(
				{
					displayName: 'Default Bank Account ID',
					name: 'defaultBankAccountId',
					type: 'string',
					default: '',
					description: "One of the vendor's existing bank accounts to pay by default",
				},
				'default_bank_account_id',
			),
		].sort(byDisplayName),
	},
	jsonBodyProperty(
		show(['update']),
		'Other body fields as JSON, such as address. Field names follow the Ramp API reference. Form fields win over the same key.',
		'{"address": {"city": "Berlin"}}',
	),

	// Get Many
	...paginationProperties(show(['getAll'])),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: show(['getAll']),
		options: [
			queryOption({ displayName: 'Name', name: 'name', type: 'string', default: '' }, 'name'),
			queryOption(
				{ displayName: 'External Vendor ID', name: 'externalVendorId', type: 'string', default: '' },
				'external_vendor_id',
			),
			queryOption(
				{
					displayName: 'Active',
					name: 'isActive',
					type: 'boolean',
					default: true,
					description: 'Whether to only return active (true) or inactive (false) vendors',
				},
				'is_active',
			),
			queryOption(
				{
					displayName: 'Include Drafts',
					name: 'includeDraft',
					type: 'boolean',
					default: true,
					description: 'Whether to include vendors that are not yet approved',
				},
				'include_draft',
			),
			queryOption({ displayName: 'Merchant ID', name: 'merchantId', type: 'string', default: '' }, 'merchant_id'),
			queryOption({ displayName: 'Vendor Owner ID', name: 'vendorOwnerId', type: 'string', default: '' }, 'vendor_owner_id'),
			dateQueryOption('Created After', 'fromCreatedAt', 'from_created_at', 'Only vendors created after this time'),
			dateQueryOption('Created Before', 'toCreatedAt', 'to_created_at', 'Only vendors created on or before this time'),
			dateQueryOption('Updated After', 'fromUpdatedAt', 'from_updated_at', 'Only vendors changed after this time'),
			dateQueryOption('Updated Before', 'toUpdatedAt', 'to_updated_at', 'Only vendors changed on or before this time'),
		].sort(byDisplayName),
	},
];
