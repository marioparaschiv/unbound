import type { Addon, AddonManifest } from '@unbound-app/types';
import { describe, expect, spyOn, test } from 'bun:test';

const { FakeAddons, makeManifest } = await import('./helpers/addons');
const { setConsentPrompt, NativeConsentRequiredError } = await import('~/lib/native-consent');

class ConsentAddons extends FakeAddons {
	consents: Record<string, string> = {};

	protected validateManifest(manifest: AddonManifest) {
		return manifest;
	}

	protected getConsents() {
		return this.consents;
	}

	protected async requestConsent(entity: Addon & { data: AddonManifest }) {
		const granted = await super.requestConsent(entity);

		if (granted) {
			this.consents[entity.id] = (entity.data.capabilities ?? []).join(',');
		}

		return granted;
	}
}

function ffiManifest(id: string, trust?: 'signed'): AddonManifest {
	return { ...makeManifest(id), capabilities: ['native.ffi.call'], ...(trust ? { trust } : {}) };
}

describe('native consent', () => {
	test('does not start an unsigned FFI plugin the user has not allowed', () => {
		const addons = new ConsentAddons();
		const required: string[] = [];

		addons.on('consent-required', (entity) => void required.push(entity.id));
		addons.load('bundle', ffiManifest('ffi.unapproved'));
		addons.start('ffi.unapproved');

		expect(addons.getEntity('ffi.unapproved')?.started).toBe(false);
		expect(addons.errors.get('ffi.unapproved')).toBeInstanceOf(NativeConsentRequiredError);
		expect(required).toEqual(['ffi.unapproved']);
	});

	test('keeps the plugin disabled when the user refuses', async () => {
		const addons = new ConsentAddons();
		const asked: string[] = [];

		setConsentPrompt(async (addon, capabilities) => {
			asked.push(`${addon.id}:${capabilities.join(',')}`);

			return false;
		});
		addons.load('bundle', ffiManifest('ffi.refused'));
		await addons.enable('ffi.refused');

		expect(asked).toEqual(['ffi.refused:native.ffi.call']);
		expect(addons.getEntity('ffi.refused')?.started).toBe(false);
		setConsentPrompt(undefined);
	});

	test('starts the plugin once the user allows it and does not ask again', async () => {
		const addons = new ConsentAddons();
		let asked = 0;

		setConsentPrompt(async () => {
			asked++;

			return true;
		});
		addons.load('bundle', ffiManifest('ffi.allowed'));
		await addons.enable('ffi.allowed');

		expect(addons.getEntity('ffi.allowed')?.started).toBe(true);
		expect(addons.consents['ffi.allowed']).toBe('native.ffi.call');

		addons.disable('ffi.allowed');
		await addons.enable('ffi.allowed');

		expect(asked).toBe(1);
		expect(addons.getEntity('ffi.allowed')?.started).toBe(true);
		setConsentPrompt(undefined);
	});

	test('logs a crashing prompt and keeps the plugin disabled', async () => {
		const addons = new ConsentAddons();
		const logged = spyOn(Reflect.get(addons, 'logger'), 'error');

		setConsentPrompt(async () => {
			throw new Error('prompt blew up');
		});
		addons.load('bundle', ffiManifest('ffi.crashed'));
		await addons.enable('ffi.crashed');

		expect(addons.getEntity('ffi.crashed')?.started).toBe(false);
		expect(addons.errors.get('ffi.crashed')).toBeInstanceOf(NativeConsentRequiredError);
		expect(logged).toHaveBeenCalledTimes(1);
		setConsentPrompt(undefined);
	});

	test('refuses when no prompt is registered', async () => {
		const addons = new ConsentAddons();

		addons.load('bundle', ffiManifest('ffi.noprompt'));
		await addons.enable('ffi.noprompt');

		expect(addons.getEntity('ffi.noprompt')?.started).toBe(false);
	});

	test('starts signed first-party FFI plugins without asking', async () => {
		const addons = new ConsentAddons();
		let asked = false;

		setConsentPrompt(async () => (asked = true));
		addons.load('bundle', ffiManifest('ffi.signed', 'signed'));
		await addons.enable('ffi.signed');

		expect(asked).toBe(false);
		expect(addons.getEntity('ffi.signed')?.started).toBe(true);
		setConsentPrompt(undefined);
	});
});
