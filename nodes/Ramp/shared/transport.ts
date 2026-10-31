import type {
	IDataObject,
	IExecuteSingleFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	IWebhookFunctions,
} from 'n8n-workflow';
import { apiBaseUrl, RAMP_CREDENTIAL_NAME } from './constants';
import { toRampError } from './errors';

/**
 * Authenticated request helper for code paths outside declarative routing
 * (list search and the trigger's webhook lifecycle). The host follows the
 * credential's Environment, the same way routed operations resolve it.
 *
 * HTTP errors are left to throw, so n8n can fetch a fresh token when Ramp
 * answers 401 to an expired one.
 */
export async function rampApiRequest(
	this: ILoadOptionsFunctions | IHookFunctions | IWebhookFunctions | IExecuteSingleFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	qs: IDataObject = {},
	body?: IDataObject,
) {
	const credentials = await this.getCredentials(RAMP_CREDENTIAL_NAME);
	const options: IHttpRequestOptions = {
		method,
		qs,
		body,
		// `page.next` links from list responses are already absolute
		url: /^https?:\/\//.test(endpoint) ? endpoint : `${apiBaseUrl(credentials.environment)}${endpoint}`,
		json: true,
	};

	try {
		return await this.helpers.httpRequestWithAuthentication.call(this, RAMP_CREDENTIAL_NAME, options);
	} catch (error) {
		throw toRampError(this.getNode(), error);
	}
}
