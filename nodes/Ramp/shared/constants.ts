export const RAMP_CREDENTIAL_NAME = 'rampOAuth2Api';

export type RampEnvironment = 'production' | 'sandbox';

/**
 * Sandbox and production are separate hosts with separate developer apps. A
 * token from one is rejected by the other, so the host always follows the
 * credential's Environment.
 */
const HOSTS: Record<RampEnvironment, string> = {
	production: 'https://api.ramp.com',
	sandbox: 'https://demo-api.ramp.com',
};

export const API_PATH = '/developer/v1';

/** Base URL of the Developer API, as an expression resolved against the credential. */
export const API_BASE_URL = `={{ $credentials.environment === "sandbox" ? "${HOSTS.sandbox}" : "${HOSTS.production}" }}${API_PATH}`;

export function apiBaseUrl(environment: unknown): string {
	return `${environment === 'sandbox' ? HOSTS.sandbox : HOSTS.production}${API_PATH}`;
}

/** The largest page Ramp's list endpoints accept. */
export const PAGE_SIZE = 100;

/** The smallest page Ramp's list endpoints accept. */
export const MIN_PAGE_SIZE = 2;

/** Upper bound for pagination loops, so a misbehaving API cannot keep a workflow busy forever. */
export const MAX_PAGES = 10_000;
