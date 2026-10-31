import type {
	IDataObject,
	ILoadOptionsFunctions,
	INodeListSearchItems,
	INodeListSearchResult,
} from 'n8n-workflow';
import { PAGE_SIZE } from '../shared/constants';
import { rampApiRequest } from '../shared/transport';

type ListPage = { data?: IDataObject[]; page?: { next?: string | null } };

function label(...parts: Array<unknown>): string {
	return parts
		.filter((part): part is string | number => (typeof part === 'string' && part !== '') || typeof part === 'number')
		.map(String)
		.join(' · ');
}

function formatMoney(value: unknown): string | undefined {
	if (typeof value !== 'object' || value === null) return undefined;
	const { amount, currency_code: currency, minor_unit_conversion_rate: rate } = value as IDataObject;
	if (typeof amount !== 'number') return undefined;
	const divisor = typeof rate === 'number' && rate > 0 ? rate : 100;
	return `${(amount / divisor).toFixed(2)} ${typeof currency === 'string' ? currency : ''}`.trim();
}

/**
 * One page of a list endpoint for a "From List" picker. The pagination token is
 * Ramp's `page.next` URL. Ramp's name filters are exact matches, so the search
 * box filters each page by substring instead.
 */
async function searchPage(
	context: ILoadOptionsFunctions,
	endpoint: string,
	qs: IDataObject,
	filter: string | undefined,
	paginationToken: string | undefined,
	toItem: (record: IDataObject) => INodeListSearchItems,
): Promise<INodeListSearchResult> {
	const page: ListPage = paginationToken
		? await rampApiRequest.call(context, 'GET', paginationToken)
		: await rampApiRequest.call(context, 'GET', endpoint, { ...qs, page_size: PAGE_SIZE });
	const needle = filter?.trim().toLowerCase();
	const results = (page.data ?? [])
		.map(toItem)
		.filter((item) => !needle || item.name.toLowerCase().includes(needle));
	return { results, paginationToken: page.page?.next ?? undefined };
}

export async function getBills(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	return await searchPage(this, '/bills', {}, filter, paginationToken, (bill) => {
		const vendor = (bill.vendor ?? {}) as IDataObject;
		return {
			name: label(
				bill.invoice_number ? `Invoice ${String(bill.invoice_number)}` : String(bill.id),
				vendor.remote_name ?? vendor.name,
				formatMoney(bill.amount),
				bill.status_summary ?? bill.status,
			),
			value: String(bill.id),
		};
	});
}

export async function getVendors(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	return await searchPage(this, '/vendors', {}, filter, paginationToken, (vendor) => ({
		name: label(vendor.name ?? vendor.display_name ?? vendor.id, vendor.is_active === false && '(inactive)', vendor.country),
		value: String(vendor.id),
	}));
}

export async function getEntities(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	return await searchPage(this, '/entities', {}, filter, paginationToken, (entity) => ({
		name: label(entity.entity_name ?? entity.id, entity.currency, entity.is_primary === true && '(primary)'),
		value: String(entity.id),
	}));
}

export async function getDepartments(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	return await searchPage(this, '/departments', {}, filter, paginationToken, (department) => ({
		name: label(department.name ?? department.id),
		value: String(department.id),
	}));
}

export async function getUsers(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	return await searchPage(this, '/users', {}, filter, paginationToken, (user) => ({
		name: label(
			[user.first_name, user.last_name].filter((part) => typeof part === 'string' && part !== '').join(' ') ||
				String(user.id),
			user.email,
			user.status === 'USER_INACTIVE' && '(inactive)',
		),
		value: String(user.id),
	}));
}

export async function getFunds(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	return await searchPage(this, '/funds', {}, filter, paginationToken, (fund) => ({
		name: label(fund.display_name ?? fund.id, fund.state),
		value: String(fund.id),
	}));
}

export async function getCards(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	// Get and Get Many can pick virtual cards; every other card action is physical only
	const cardType = this.getCurrentNodeParameter('cardType') === 'virtual' ? 'virtual' : 'physical';
	return await searchPage(this, `/cards/${cardType}`, {}, filter, paginationToken, (card) => ({
		name: label(
			card.display_name ?? card.id,
			card.cardholder_name,
			typeof card.last_four === 'string' && `•••• ${card.last_four}`,
			card.state,
		),
		value: String(card.id),
	}));
}

export async function getPurchaseOrders(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	return await searchPage(this, '/purchase-orders', {}, filter, paginationToken, (order) => ({
		name: label(order.purchase_order_number ?? order.id, order.name, formatMoney(order.amount)),
		value: String(order.id),
	}));
}
