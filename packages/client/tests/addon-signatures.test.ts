import type { NativeAddonVerification } from '@unbound-app/types';
import { describe, expect, test } from 'bun:test';

const verifications: { manifest: string; bundle: string }[] = [];
let nextVerification: NativeAddonVerification = { status: 'signed', signer: 'the production key' };

Object.defineProperty(globalThis, 'NativePlatform', {
	configurable: true,
	writable: true,
	value: {
		platform: 'ios',
		device: { platform: 'ios' },
		addons: {
			verify(manifest: string, bundle: string) {
				verifications.push({ manifest, bundle });

				return nextVerification;
			},
		},
	},
});

const { makeManifest } = await import('./helpers/addons');
const { verifySignature } = await import('~/lib/addon-download');

const signature = { version: 1 as const, ed25519: 'c2lnbmF0dXJl' };

describe('addon signatures', () => {
	test('records a valid signature as signed and passes the manifest without trust', () => {
		nextVerification = { status: 'signed', signer: 'the production key' };
		verifications.length = 0;
		const manifest = { ...makeManifest('signed.addon'), signature, trust: 'signed' as const };
		const checked = verifySignature(manifest, 'bundle');

		expect(checked.trust).toBe('signed');
		expect(verifications[0]?.bundle).toBe('bundle');
		expect(JSON.parse(verifications[0]?.manifest ?? '{}')).not.toHaveProperty('trust');
		expect(JSON.parse(verifications[0]?.manifest ?? '{}').signature).toEqual(signature);
	});

	test('refuses a bundle whose signature does not match', () => {
		nextVerification = {
			status: 'invalid',
			problem: 'the signature does not match the bundle',
		};

		expect(() =>
			verifySignature({ ...makeManifest('tampered.addon'), signature }, 'changed'),
		).toThrow(/Refused tampered\.addon/);
	});

	test('keeps unsigned addons installable', () => {
		nextVerification = { status: 'unsigned' };

		expect(verifySignature(makeManifest('third.party'), 'bundle').trust).toBe('unsigned');
	});

	test('refuses an unsigned update for a signed addon', () => {
		nextVerification = { status: 'unsigned' };

		expect(() => verifySignature(makeManifest('stripped.addon'), 'bundle', 'signed')).toThrow(
			/Refused stripped\.addon: .*\bsigned\b/,
		);
		expect(verifySignature(makeManifest('still.unsigned'), 'bundle', 'unsigned').trust).toBe(
			'unsigned',
		);
	});
});
