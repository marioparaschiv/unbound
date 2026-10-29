import type { AddonManifest } from '@unbound-app/types';
import { describe, expect, test } from 'bun:test';

import { FakeAddons } from './helpers/addons';

class ValidatingAddons extends FakeAddons {
	check(manifest: AddonManifest) {
		this.validateManifest(manifest);
	}
}

function manifest(overrides: Partial<AddonManifest>): AddonManifest {
	return {
		id: 'unbound.example',
		name: 'Example',
		description: 'An example.',
		authors: [{ name: 'Someone', id: '1' }],
		version: '1.0.0',
		main: 'index.js',
		icon: '',
		updates: '',
		folder: '',
		path: '',
		url: '',
		...overrides,
	};
}

describe('manifest paths', () => {
	const addons = new ValidatingAddons();

	test('a well-formed manifest passes', () => {
		expect(() => addons.check(manifest({}))).not.toThrow();
		expect(() => addons.check(manifest({ main: 'dist/index.js' }))).not.toThrow();
	});

	test('main may not leave the addon folder', () => {
		for (const main of [
			'../settings.json',
			'../../../shared_prefs/x.xml',
			'/etc/hosts',
			'a/../../b.js',
		]) {
			expect(() => addons.check(manifest({ main }))).toThrow('Manifest main');
		}
	});

	test('the id must be a plain folder name', () => {
		for (const id of ['../Themes/x', 'a/b', '.hidden']) {
			expect(() => addons.check(manifest({ id }))).toThrow('Manifest id must be');
		}
	});
});
