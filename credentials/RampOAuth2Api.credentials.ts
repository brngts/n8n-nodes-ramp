import type { Icon, ICredentialTestRequest, ICredentialType, INodeProperties } from 'n8n-workflow';

/** Every scope the Ramp node and Ramp Trigger use, read and write. */
export const DEFAULT_SCOPES = [
	'business:read',
	'entities:read',
	'transactions:read',
	'transactions:write',
	'memos:read',
	'memos:write',
	'receipts:read',
	'reimbursements:read',
	'bills:read',
	'bills:write',
	'vendors:read',
	'vendors:write',
	'purchase_orders:read',
	'purchase_orders:write',
	'cards:read',
	'cards:write',
	'funds:read',
	'funds:write',
	'users:read',
	'users:write',
	'departments:read',
	'departments:write',
].join(' ');

export class RampOAuth2Api implements ICredentialType {
	name = 'rampOAuth2Api';

	extends = ['oAuth2Api'];

	displayName = 'Ramp OAuth2 API';

	icon: Icon = { light: 'file:../icons/ramp.svg', dark: 'file:../icons/ramp.dark.svg' };

	documentationUrl = 'https://docs.ramp.com/developer-api/v1/authorization';

	properties: INodeProperties[] = [
		{
			displayName: 'Environment',
			name: 'environment',
			type: 'options',
			options: [
				{
					name: 'Production',
					value: 'production',
					description: 'Live data on api.ramp.com',
				},
				{
					name: 'Sandbox',
					value: 'sandbox',
					description: 'Demo data on demo-api.ramp.com',
				},
			],
			default: 'production',
			description:
				'Sandbox and production need separate Ramp developer apps. The client ID and secret must come from an app in the environment you pick.',
		},
		{
			displayName: 'Grant Type',
			name: 'grantType',
			type: 'hidden',
			default: 'clientCredentials',
		},
		{
			displayName: 'Access Token URL',
			name: 'accessTokenUrl',
			type: 'hidden',
			default:
				'={{ $self["environment"] === "sandbox" ? "https://demo-api.ramp.com/developer/v1/token" : "https://api.ramp.com/developer/v1/token" }}',
		},
		{
			displayName: 'Auth URI Query Parameters',
			name: 'authQueryParameters',
			type: 'hidden',
			default: '',
		},
		{
			displayName: 'Scope',
			name: 'scope',
			type: 'string',
			default: DEFAULT_SCOPES,
			description:
				'Space-separated scopes to request. Every scope must also be allowed on the Ramp developer app, otherwise Ramp refuses the token. Remove the ones your app does not have, for example the write scopes for a read-only integration. Keep business:read, which the credential test uses.',
		},
		{
			displayName: 'Authentication',
			name: 'authentication',
			type: 'hidden',
			default: 'header',
		},
	];

	test: ICredentialTestRequest = {
		request: {
			baseURL:
				'={{ $credentials.environment === "sandbox" ? "https://demo-api.ramp.com" : "https://api.ramp.com" }}',
			url: '/developer/v1/business',
			method: 'GET',
		},
	};
}
