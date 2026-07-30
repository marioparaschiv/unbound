import type { AddonManifest } from '@unbound-app/types';
import { describe, expect, test } from 'bun:test';

import {
	serializeMessage,
	parseMessage,
	type PluginPushRequest,
	type PluginPushResult,
} from '../src/index';

const manifest: AddonManifest = {
	id: 'com.example.plugin',
	name: 'Example',
	description: 'An example plugin.',
	authors: [{ name: 'Mario', id: '1' }],
	icon: '',
	updates: '',
	main: 'index.js',
	version: '1.0.0',
	folder: '',
	path: '',
	url: '',
};

describe('plugin-push round-trip', () => {
	test('a valid plugin-push survives serialize → parse intact', () => {
		const message: PluginPushRequest = {
			type: 'plugin-push',
			id: 'push-1',
			addonId: manifest.id,
			bundle: 'module.exports = {};',
			manifest,
		};

		expect(parseMessage(serializeMessage(message))).toEqual(message);
	});

	test('a valid plugin-push-result survives serialize → parse intact', () => {
		const ok: PluginPushResult = { type: 'plugin-push-result', id: 'push-1', ok: true };
		const failed: PluginPushResult = {
			type: 'plugin-push-result',
			id: 'push-2',
			ok: false,
			error: 'boom',
		};

		expect(parseMessage(serializeMessage(ok))).toEqual(ok);
		expect(parseMessage(serializeMessage(failed))).toEqual(failed);
	});
});

describe('parseMessage rejection', () => {
	test('rejects an unknown type', () => {
		expect(parseMessage(JSON.stringify({ type: 'plugin-pull', id: 'x' }))).toBeUndefined();
	});

	test('rejects a missing type', () => {
		expect(parseMessage(JSON.stringify({ id: 'x', bundle: 'y' }))).toBeUndefined();
	});

	test('rejects invalid JSON', () => {
		expect(parseMessage('{not json')).toBeUndefined();
	});
});

describe('allowlist', () => {
	// Guards the silent-drop footgun: a type absent from MESSAGE_TYPES is dropped by parseMessage at
	// both ends even though the wire frame is well-formed.
	test('the new plugin-push types are recognised', () => {
		const push = { type: 'plugin-push', id: 'a', addonId: 'b', bundle: 'c', manifest };
		const result = { type: 'plugin-push-result', id: 'a', ok: true };

		expect(parseMessage(JSON.stringify(push))).toBeDefined();
		expect(parseMessage(JSON.stringify(result))).toBeDefined();
	});
});
