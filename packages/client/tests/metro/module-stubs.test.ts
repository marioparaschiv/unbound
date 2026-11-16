import { beforeEach, describe, expect, test } from 'bun:test';

import { startFakeMetro } from '../helpers/fake-metro';

const REACT = 19;
const SENTRY = 676;
const OTHER = 677;

const disk = new Map<string, string>();
let build = '123283';
let sentryRuns = 0;

Object.assign(globalThis, {
	window: globalThis,
	NativePlatform: {
		files: {
			read: (path: string) => disk.get(path),
			write: (path: string, text: string) => Boolean(disk.set(path, text)),
		},
	},
	nativeModuleProxy: {
		NativeClientInfoModule: { getConstants: () => ({ Build: build, OTABuild: '7' }) },
	},
});

const metro = startFakeMetro();

metro.define(REACT, [], (_, __, ___, ____, module) => {
	module.exports = { createElement: () => null };
});
metro.define(SENTRY, [], (_, __, ___, ____, module) => {
	sentryRuns++;
	module.exports = { ReactNativeClient: class {}, nativeCrash: () => undefined };
});
metro.define(OTHER, [], (_, __, ___, ____, module) => {
	module.exports = { other: true };
});

const { setModuleStubs } = await import('~/metro/capture');

// Each import is one launch: the module reads the stubs file once and keeps its state.
let launch = 0;

async function startLaunch() {
	launch++;

	return import(`../../src/metro/module-stubs.ts?launch=${launch}`);
}

beforeEach(() => {
	disk.clear();
	build = '123283';
});

describe('module stubs', () => {
	test('records the Sentry SDK id on a first launch and stubs it on the next', async () => {
		const first = await startLaunch();

		// The real SDK required React, so the stub must require it in its place.
		globalThis.React = metro.require(REACT);

		expect(first.resolveModuleStub(SENTRY)).toBeUndefined();

		first.recordModuleStub({ other: true }, OTHER);
		expect(disk.size).toBe(0);

		first.recordModuleStub(
			{ ReactNativeClient: class {}, nativeCrash: () => undefined },
			SENTRY,
		);
		expect(JSON.parse(disk.get('metro-stubs.json')!)).toEqual({
			fingerprint: '123283:7:3',
			ids: { sentry: SENTRY },
			requires: [REACT],
		});

		const record = globalThis.modules.get(REACT)!;

		record.isInitialized = false;
		record.factory = () => undefined;

		const second = await startLaunch();

		setModuleStubs(second.resolveModuleStub);

		const exports = metro.require(SENTRY);

		expect(sentryRuns).toBe(0);
		expect(exports.ReactNativeClient).toBeUndefined();
		expect(typeof exports.init).toBe('function');
		expect(record.isInitialized).toBe(true);
		expect(metro.require(OTHER)).toEqual({ other: true });
	});

	test('runs the real module when the Discord build changed', async () => {
		disk.set(
			'metro-stubs.json',
			JSON.stringify({ fingerprint: '123000:7:3', ids: { sentry: SENTRY } }),
		);

		const launched = await startLaunch();

		expect(launched.resolveModuleStub(SENTRY)).toBeUndefined();

		launched.recordModuleStub(
			{ ReactNativeClient: class {}, nativeCrash: () => undefined },
			SENTRY,
		);
		expect(JSON.parse(disk.get('metro-stubs.json')!).fingerprint).toBe('123283:7:3');
	});

	test('stubs nothing when the stubs file is unreadable', async () => {
		disk.set('metro-stubs.json', '{not json');

		const launched = await startLaunch();

		expect(launched.resolveModuleStub(SENTRY)).toBeUndefined();
	});
});
