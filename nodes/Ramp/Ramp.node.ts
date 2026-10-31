import { NodeConnectionTypes, type INodeType, type INodeTypeDescription } from 'n8n-workflow';
import {
	getBills,
	getCards,
	getDepartments,
	getEntities,
	getFunds,
	getPurchaseOrders,
	getUsers,
	getVendors,
} from './listSearch';
import { billDescription } from './resources/bill';
import { cardDescription } from './resources/card';
import { departmentDescription } from './resources/department';
import { entityDescription } from './resources/entity';
import { fundDescription } from './resources/fund';
import { purchaseOrderDescription } from './resources/purchaseOrder';
import { receiptDescription } from './resources/receipt';
import { reimbursementDescription } from './resources/reimbursement';
import { transactionDescription } from './resources/transaction';
import { userDescription } from './resources/user';
import { vendorDescription } from './resources/vendor';
import { API_BASE_URL, RAMP_CREDENTIAL_NAME } from './shared/constants';

export class Ramp implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Ramp',
		name: 'ramp',
		icon: { light: 'file:../../icons/ramp.svg', dark: 'file:../../icons/ramp.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Work with transactions, bills, vendors, cards, funds and users in Ramp spend management',
		defaults: {
			name: 'Ramp',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: RAMP_CREDENTIAL_NAME,
				required: true,
			},
		],
		requestDefaults: {
			baseURL: API_BASE_URL,
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Bill', value: 'bill' },
					{ name: 'Card', value: 'card' },
					{ name: 'Department', value: 'department' },
					{ name: 'Entity', value: 'entity' },
					{ name: 'Fund', value: 'fund' },
					{ name: 'Purchase Order', value: 'purchaseOrder' },
					{ name: 'Receipt', value: 'receipt' },
					{ name: 'Reimbursement', value: 'reimbursement' },
					{ name: 'Transaction', value: 'transaction' },
					{ name: 'User', value: 'user' },
					{ name: 'Vendor', value: 'vendor' },
				],
				default: 'transaction',
			},
			...billDescription,
			...cardDescription,
			...departmentDescription,
			...entityDescription,
			...fundDescription,
			...purchaseOrderDescription,
			...receiptDescription,
			...reimbursementDescription,
			...transactionDescription,
			...userDescription,
			...vendorDescription,
		],
	};

	methods = {
		listSearch: {
			getBills,
			getCards,
			getDepartments,
			getEntities,
			getFunds,
			getPurchaseOrders,
			getUsers,
			getVendors,
		},
	};
}
