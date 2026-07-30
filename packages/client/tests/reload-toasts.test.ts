import type { Addon, AddonManifest } from '@unbound-app/types';
import { describe, expect, test } from 'bun:test';

import { reloadToast, reloadErrorToast } from '~/builtins/reload-toasts';

function addon(id: string, name: string): Addon {
	const manifest = { id, name } as AddonManifest;

	return { id, data: manifest, bundle: '', instance: null, started: true, failed: false };
}

describe('reloadToast', () => {
	test('names the plugin and is keyed by addon id', () => {
		const toast = reloadToast(addon('com.example.x', 'Example'));

		expect(toast.id).toBe('reload:com.example.x');
		expect(toast.content).toBe('Reloaded Example.');
	});
});

describe('reloadErrorToast', () => {
	test('names the plugin and surfaces the error, sharing the reload id', () => {
		const toast = reloadErrorToast(addon('com.example.x', 'Example'), new Error('boom'));

		expect(toast.id).toBe('reload:com.example.x');
		expect(toast.content).toBe('Example failed to reload: boom');
	});
});
