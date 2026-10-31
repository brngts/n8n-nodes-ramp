import { createHmac, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { parseSignature, verifyRampSignature } from '../nodes/RampTrigger/signature';

// Generated per run, like the secret Ramp returns when a subscription is created
const secret = randomBytes(24).toString('hex');
const rawBody = '{"id":"a461a658","type":"transactions.cleared","object":{"id":"3aa9eed1"}}';
const hexSignature = createHmac('sha256', secret).update(rawBody).digest('hex');

describe('parseSignature', () => {
	it('accepts a bare digest or a sha256= prefix', () => {
		expect(parseSignature(hexSignature)).toBe(hexSignature);
		expect(parseSignature(`sha256=${hexSignature}`)).toBe(hexSignature);
		expect(parseSignature([hexSignature])).toBe(hexSignature);
		expect(parseSignature('')).toBeUndefined();
		expect(parseSignature(undefined)).toBeUndefined();
	});
});

describe('verifyRampSignature', () => {
	it('accepts the hex HMAC-SHA256 of the raw body', () => {
		expect(verifyRampSignature({ secret, rawBody, signatureHeader: hexSignature })).toBe(true);
		expect(verifyRampSignature({ secret, rawBody: Buffer.from(rawBody), signatureHeader: hexSignature })).toBe(true);
		expect(verifyRampSignature({ secret, rawBody, signatureHeader: hexSignature.toUpperCase() })).toBe(true);
	});

	it('accepts a base64 digest and a base64-decoded key', () => {
		const base64 = createHmac('sha256', secret).update(rawBody).digest('base64');
		expect(verifyRampSignature({ secret, rawBody, signatureHeader: base64 })).toBe(true);

		const encodedSecret = randomBytes(30).toString('base64');
		const signedWithDecodedKey = createHmac('sha256', Buffer.from(encodedSecret, 'base64')).update(rawBody).digest('hex');
		expect(verifyRampSignature({ secret: encodedSecret, rawBody, signatureHeader: signedWithDecodedKey })).toBe(true);
	});

	it('rejects a changed body, another secret or a missing header', () => {
		expect(verifyRampSignature({ secret, rawBody: `${rawBody} `, signatureHeader: hexSignature })).toBe(false);
		expect(verifyRampSignature({ secret: randomBytes(24).toString('hex'), rawBody, signatureHeader: hexSignature })).toBe(false);
		expect(verifyRampSignature({ secret, rawBody, signatureHeader: undefined })).toBe(false);
		expect(verifyRampSignature({ secret: '', rawBody, signatureHeader: hexSignature })).toBe(false);
	});

	it('does not accept a body re-serialized from parsed JSON when formatting differs', () => {
		const pretty = JSON.stringify(JSON.parse(rawBody), null, 2);
		expect(verifyRampSignature({ secret, rawBody: pretty, signatureHeader: hexSignature })).toBe(false);
	});
});
