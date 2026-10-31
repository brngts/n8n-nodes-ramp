import type { INodePropertyOptions } from 'n8n-workflow';

export const SYNC_STATUS_OPTIONS: INodePropertyOptions[] = [
	{ name: 'Not Sync Ready', value: 'NOT_SYNC_READY' },
	{ name: 'Sync Ready', value: 'SYNC_READY' },
	{ name: 'Synced', value: 'SYNCED' },
];

export const USER_ROLE_OPTIONS: INodePropertyOptions[] = [
	{ name: 'Admin', value: 'BUSINESS_ADMIN' },
	{ name: 'Auditor', value: 'AUDITOR' },
	{ name: 'Bookkeeper', value: 'BUSINESS_BOOKKEEPER' },
	{ name: 'Business Owner', value: 'BUSINESS_OWNER' },
	{ name: 'Employee', value: 'BUSINESS_USER' },
	{ name: 'Guest', value: 'GUEST_USER' },
	{ name: 'IT Admin', value: 'IT_ADMIN' },
];

export const PAYMENT_METHOD_OPTIONS: INodePropertyOptions[] = [
	{ name: 'ACH', value: 'ACH' },
	{ name: 'Card', value: 'CARD' },
	{ name: 'Check', value: 'CHECK' },
	{ name: 'Crypto Wallet Transfer', value: 'CRYPTO_WALLET_TRANSFER' },
	{ name: 'Domestic Wire', value: 'DOMESTIC_WIRE' },
	{ name: 'International', value: 'INTERNATIONAL' },
	{ name: 'Local Bank Transfer', value: 'LOCAL_BANK_TRANSFER' },
	{ name: 'One-Time Card', value: 'ONE_TIME_CARD' },
	{ name: 'One-Time Card Delivery', value: 'ONE_TIME_CARD_DELIVERY' },
	{ name: 'Paid Manually', value: 'PAID_MANUALLY' },
	{ name: 'SWIFT', value: 'SWIFT' },
];

const ACRONYMS = new Set(['ACH', 'SWIFT', 'IT', 'PO', 'ERP']);

/** Options for a Ramp enum, labelled from the value: `AWAITING_PAYMENT` becomes "Awaiting Payment". */
export function enumOptions(values: string[]): INodePropertyOptions[] {
	return values
		.map((value) => ({
			name: value
				.split('_')
				.map((word) => (ACRONYMS.has(word) ? word : word.charAt(0) + word.slice(1).toLowerCase()))
				.join(' '),
			value,
		}))
		.sort((a, b) => a.name.localeCompare(b.name));
}

export const BILL_STATUS_SUMMARY_OPTIONS = enumOptions([
	'APPROVAL_PENDING',
	'APPROVAL_REJECTED',
	'ARCHIVED',
	'AWAITING_PAYMENT',
	'AWAITING_RELEASE',
	'BLOCKED',
	'HELD_BY_PROVIDER',
	'ON_HOLD',
	'PAYMENT_COMPLETED',
	'PAYMENT_DETAILS_MISSING',
	'PAYMENT_ERROR',
	'PAYMENT_NOT_INSTRUCTED',
	'PAYMENT_PROCESSING',
	'PAYMENT_READY',
	'PAYMENT_SCHEDULED',
	'PENDING_VENDOR_APPROVAL',
	'WAITING_FOR_TRANSACTION_MATCH',
	'WAITING_FOR_TRANSFER_MATCH',
	'WAITING_FOR_VENDOR',
]);

export const REIMBURSEMENT_STATE_OPTIONS = enumOptions([
	'APPROVED',
	'AWAITING_EXPORT',
	'AWAITING_PAYMENT',
	'AWAITING_PUSH_PAYMENT',
	'CANCELED',
	'DELETED',
	'DRAFT',
	'EXPORTED',
	'EXPORT_FAILED',
	'EXPORT_INITIATED',
	'EXPORT_MARKED_AS_FAILED',
	'EXPORT_SUCCESSFUL',
	'FAILED_REIMBURSEMENT',
	'INIT',
	'MANUALLY_REIMBURSED',
	'MISSING_ACH',
	'PAYROLL_FAILED',
	'PAYROLL_SUBMITTED',
	'PENDING',
	'PROCESSING',
	'PUSH_PAYMENT_FAILED',
	'PUSH_PAYMENT_INITIATED',
	'REIMBURSED',
	'REIMBURSED_VIA_PAYROLL',
	'REIMBURSED_VIA_PUSH',
	'REJECTED',
]);
