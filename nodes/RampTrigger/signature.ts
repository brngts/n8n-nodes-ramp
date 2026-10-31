import { createHmac, timingSafeEqual } from 'node:crypto';

/** Strips an optional `sha256=` scheme prefix from the `X-Ramp-Signature` header. */
export function parseSignature(header: unknown): string | undefined {
	const value = Array.isArray(header) ? header[0] : header;
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	const signature = trimmed.toLowerCase().startsWith('sha256=') ? trimmed.slice('sha256='.length) : trimmed;
	return signature === '' ? undefined : signature;
}

/**
 * Candidate HMAC keys for a secret. Ramp documents the key as "your webhook
 * secret" without saying whether it is used as text or decoded first, so both
 * readings are tried. Either way only the holder of the secret can sign.
 */
function candidateKeys(secret: string): Buffer[] {
	const keys = [Buffer.from(secret, 'utf8')];
	if (/^[A-Za-z0-9+/=_-]+$/.test(secret) && secret.length % 4 === 0) {
		const decoded = Buffer.from(secret, 'base64');
		if (decoded.length > 0 && !decoded.equals(keys[0])) keys.push(decoded);
	}
	return keys;
}

function decodeSignature(signature: string): Buffer[] {
	const decoded: Buffer[] = [];
	if (/^[0-9a-fA-F]+$/.test(signature) && signature.length % 2 === 0) {
		decoded.push(Buffer.from(signature, 'hex'));
	}
	const base64 = Buffer.from(signature, 'base64');
	if (base64.length > 0) decoded.push(base64);
	return decoded;
}

type VerifyOptions = {
	secret: string;
	rawBody: Buffer | string;
	signatureHeader: unknown;
};

/**
 * Verifies a Ramp webhook delivery: `X-Ramp-Signature` is an HMAC-SHA256 of
 * the raw request body, keyed with the secret Ramp returned when the
 * subscription was created. The comparison runs on the exact bytes received,
 * never on re-serialized JSON.
 */
export function verifyRampSignature({ secret, rawBody, signatureHeader }: VerifyOptions): boolean {
	const signature = parseSignature(signatureHeader);
	if (!signature || secret === '') return false;
	const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
	const received = decodeSignature(signature);

	return candidateKeys(secret).some((key) => {
		const expected = createHmac('sha256', key).update(body).digest();
		return received.some((actual) => actual.length === expected.length && timingSafeEqual(actual, expected));
	});
}
