import type { AuthoredAddonManifest } from '@unbound-app/types';
import { CORE_BUCKET } from '@unbound-app/types/settings';
import { describe, expect, test } from 'bun:test';

import {
	CONTROLLER_ENDPOINT_MARKER,
	DEFAULT_BRIDGE_PORT,
	DEFAULT_EVAL_TIMEOUT_MS,
	MAX_EVAL_TIMEOUT_MS,
	resolveEvalTimeout,
	serializeMessage,
	parseMessage,
	type EvalRequest,
	type PushRequest,
	type PushResult,
} from '~/index';

import contract from './fixtures/devtools-contract.json';

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
		const message: PushRequest = {
			type: 'plugin-push',
			id: 'push-1',
			addonId: manifest.id,
			bundle: 'module.exports = {};',
			manifest,
		};

		expect(parseMessage(serializeMessage(message))).toEqual(message);
	});

	test('a plugin-push carrying bytecode survives intact, and malformed bytecode is rejected', () => {
		const message: PushRequest = {
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

	test('a theme push keeps its kind, and an unknown kind is rejected', () => {
		const message: PushRequest = {
			type: 'plugin-push',
			id: 'push-1',
			addonId: manifest.id,
			kind: 'theme',
			bundle: '{"type":"dark","semantic":{},"raw":{}}',
			manifest,
		};

		expect(parseMessage(serializeMessage(message))).toEqual(message);
		expect(parseMessage(JSON.stringify({ ...message, kind: 'font' }))).toBeUndefined();
	});

	test('a valid plugin-push-result survives serialize → parse intact', () => {
		const ok: PushResult = { type: 'plugin-push-result', id: 'push-1', ok: true };
		const failed: PushResult = {
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

/** A malformed override for one view property. */
type PropertyPatch = { value?: string[]; kind?: string; unit?: number };

describe('view finder frames', () => {
	const { viewsRequest, viewsPage, viewDetailsOk } = contract.frames;
	const [property] = viewDetailsOk.details.sections[0]?.properties ?? [];
	const withProperty = (patch: PropertyPatch) => ({
		...viewDetailsOk,
		details: {
			...viewDetailsOk.details,
			sections: [{ title: 'Text', properties: [{ ...property, ...patch }] }],
		},
	});

	test('a views-request pages with a whole, non-negative offset and limit', () => {
		const { offset: _, limit: __, ...firstPage } = viewsRequest;
		const raw = JSON.stringify(firstPage);

		expect(JSON.stringify(parseMessage(raw))).toBe(raw);

		for (const bad of [{ offset: -1 }, { offset: 1.5 }, { limit: '100' }]) {
			expect(parseMessage(JSON.stringify({ ...viewsRequest, ...bad }))).toBeUndefined();
		}
	});

	test('a views-result may omit its total but not carry a bad one', () => {
		const { total: _, ...unpaged } = viewsPage;
		const raw = JSON.stringify(unpaged);

		expect(JSON.stringify(parseMessage(raw))).toBe(raw);
		expect(parseMessage(JSON.stringify({ ...viewsPage, total: -1 }))).toBeUndefined();
	});

	test('rejects view details whose chain, sections or properties are malformed', () => {
		const bad = [
			{ ...viewDetailsOk, details: { ...viewDetailsOk.details, classChain: [1] } },
			{ ...viewDetailsOk, details: { classChain: [] } },
			{ ...viewDetailsOk, details: { classChain: [], sections: [{ title: 'Text' }] } },
			withProperty({ value: ['16'] }),
			withProperty({ kind: 'gradient' }),
			withProperty({ unit: 4 }),
			{ type: 'view-details-result', id: 'x', ok: true },
			{ type: 'view-details-request', id: 'x' },
		];

		for (const frame of bad) {
			expect(parseMessage(JSON.stringify(frame))).toBeUndefined();
		}
	});
});

describe('resolveEvalTimeout', () => {
	test('honours a positive timeout and falls back to the default otherwise', () => {
		expect(resolveEvalTimeout(30_000)).toBe(30_000);
		expect(resolveEvalTimeout(undefined)).toBe(DEFAULT_EVAL_TIMEOUT_MS);
		expect(resolveEvalTimeout(0)).toBe(DEFAULT_EVAL_TIMEOUT_MS);
		expect(resolveEvalTimeout(-5)).toBe(DEFAULT_EVAL_TIMEOUT_MS);
		expect(resolveEvalTimeout(Number.NaN)).toBe(DEFAULT_EVAL_TIMEOUT_MS);
		expect(resolveEvalTimeout(Number.POSITIVE_INFINITY)).toBe(MAX_EVAL_TIMEOUT_MS);
	});
});

// The DevTools app (`apps/devtools/crates/core/src/bridge.rs`) reads the same fixture, so a change on
// either side of the wire fails one of the two suites.
describe('the DevTools contract', () => {
	test('names the default port and the controller marker', () => {
		expect(contract.defaultBridgePort).toBe(DEFAULT_BRIDGE_PORT);
		expect(contract.controllerEndpointMarker).toBe(CONTROLLER_ENDPOINT_MARKER);
	});

	test('holds frames the protocol accepts unchanged', () => {
		for (const frame of Object.values(contract.frames)) {
			const raw = JSON.stringify(frame);

			expect(JSON.stringify(parseMessage(raw))).toBe(raw);
		}
	});

	test('reads the bridge address from the core settings store', () => {
		expect(contract.addressSetting.store).toBe(CORE_BUCKET);
	});
});
