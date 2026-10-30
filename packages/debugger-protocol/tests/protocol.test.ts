import type { AuthoredAddonManifest } from '@unbound-app/types';
import { describe, expect, test } from 'bun:test';

import {
	serializeMessage,
	parseMessage,
	type EvalRequest,
	type PluginPushRequest,
	type PluginPushResult,
} from '../src/index';

const manifest: AuthoredAddonManifest = {
	id: 'com.example.plugin',
	name: 'Example',
	description: 'An example plugin.',
	authors: [{ name: 'Mario', id: '1' }],
	main: 'index.js',
	version: '1.0.0',
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

	test('a plugin-push carrying bytecode survives intact, and malformed bytecode is rejected', () => {
		const message: PluginPushRequest = {
			type: 'plugin-push',
			id: 'push-1',
			addonId: manifest.id,
			bundle: 'module.exports = {};',
			manifest,
			bytecode: { '98': 'xh+8Aw==' },
		};

		expect(parseMessage(serializeMessage(message))).toEqual(message);
		expect(parseMessage(JSON.stringify({ ...message, bytecode: { '98': 1 } }))).toBeUndefined();
		expect(parseMessage(JSON.stringify({ ...message, bytecode: ['x'] }))).toBeUndefined();
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

	test('rejects frames missing the fields their type needs', () => {
		expect(parseMessage(JSON.stringify({ type: 'log', level: 1 }))).toBeUndefined();
		expect(
			parseMessage(JSON.stringify({ type: 'log', level: 9, message: 'x' })),
		).toBeUndefined();
		expect(parseMessage(JSON.stringify({ type: 'log', level: 1, message: 7 }))).toBeUndefined();
		expect(parseMessage(JSON.stringify({ type: 'eval-result', ok: true }))).toBeUndefined();
		expect(
			parseMessage(
				JSON.stringify({ type: 'plugin-push', id: 'a', addonId: 'b', bundle: 'c' }),
			),
		).toBeUndefined();
		expect(parseMessage(JSON.stringify({ type: 'device-status' }))).toBeUndefined();
		expect(parseMessage(JSON.stringify(['log']))).toBeUndefined();
	});

	test('rejects results whose payload does not match their outcome', () => {
		const evalResult = { type: 'eval-result', id: 'a' } as const;
		const pushResult = { type: 'plugin-push-result', id: 'a' } as const;

		expect(
			parseMessage(JSON.stringify({ ...evalResult, ok: true, error: 'x' })),
		).toBeUndefined();
		expect(
			parseMessage(JSON.stringify({ ...evalResult, ok: false, value: 'x' })),
		).toBeUndefined();
		expect(parseMessage(JSON.stringify({ ...pushResult, ok: false }))).toBeUndefined();
		expect(parseMessage(JSON.stringify({ ...evalResult, ok: true, value: '1' }))).toEqual({
			...evalResult,
			ok: true,
			value: '1',
		});
		expect(parseMessage(JSON.stringify({ ...evalResult, ok: false, error: 'x' }))).toEqual({
			...evalResult,
			ok: false,
			error: 'x',
		});
	});

	test('accepts a well-formed log line', () => {
		const log = { type: 'log', level: 2, message: 'hi' } as const;

		expect(parseMessage(JSON.stringify(log))).toEqual(log);
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

describe('eval round-trip', () => {
	test('an eval carrying a timeout survives serialize → parse intact', () => {
		const message: EvalRequest = { type: 'eval', id: 'eval-1', code: '1', timeout: 30_000 };

		expect(parseMessage(serializeMessage(message))).toEqual(message);
	});
});

describe('hello', () => {
	const device = {
		platform: 'ios',
		discordVersion: '351.0',
		loaderVersion: '1.0.0',
		clientVersion: '0.9.0',
	};

	test('a device hello and a status carrying it parse intact', () => {
		const hello = { type: 'hello', device } as const;
		const status = { type: 'device-status', connected: true, device } as const;

		expect(parseMessage(JSON.stringify(hello))).toEqual(hello);
		expect(parseMessage(JSON.stringify(status))).toEqual(status);
		expect(parseMessage(JSON.stringify({ type: 'device-status', connected: false }))).toEqual({
			type: 'device-status',
			connected: false,
		});
	});

	test('a hello missing a version is rejected', () => {
		const { clientVersion: _, ...partial } = device;

		expect(parseMessage(JSON.stringify({ type: 'hello', device: partial }))).toBeUndefined();
		expect(
			parseMessage(
				JSON.stringify({ type: 'device-status', connected: true, device: partial }),
			),
		).toBeUndefined();
	});
});
