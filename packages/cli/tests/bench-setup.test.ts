import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { afterEach, describe, expect, test } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { planFromFile, planFromRefs, schedule } from '../src/bench/plan';
import { benchSettings, withoutModuleCache } from '../src/bench/device';
import { acquireLock, isStaleBenchLock } from '../src/bench/lock';
import { parseDotEnv } from '../src/bench/environment';

const roots: string[] = [];

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function lockDir(): string {
	const root = mkdtempSync(join(tmpdir(), 'unbound-bench-lock-'));

	roots.push(root);

	return join(root, 'unbound-vphone.lock');
}

describe('plan', () => {
	test('names command-line refs A, B, C', () => {
		expect(
			planFromRefs(['main', 'main', 'perf/x']).variants.map((v) => `${v.name}=${v.ref}`),
		).toEqual(['A=main', 'B=main', 'C=perf/x']);
	});

	test('visits every variant each round, reversing the order on odd rounds', () => {
		const order = schedule(planFromRefs(['main', 'perf/x'], { rounds: 3 })).map(
			(block) => block.variant.name,
		);

		expect(order).toEqual(['A', 'B', 'B', 'A', 'A', 'B']);
	});

	test('lets command-line counts win over the variants file', () => {
		const plan = planFromFile(
			{ rounds: 5, warm: 4, variants: [{ name: 'base', ref: 'main' }] },
			{ warm: 1 },
		);

		expect(plan).toMatchObject({ rounds: 5, warm: 1, cold: 1, idleMs: 25_000 });
	});

	test('rejects a variants file that names a variant twice', () => {
		const plan = planFromFile({
			variants: [
				{ name: 'x', ref: 'main' },
				{ name: 'x', ref: 'dev' },
			],
		});

		expect(plan).toEqual({ error: 'The variants file names a variant twice.' });
	});
});

describe('device settings', () => {
	const current = {
		unbound: {
			loader: { update: { url: 'http://dev:3100/unbound.bundle', hmr: true } },
			debugger: { enabled: true, address: 'dev:9091' },
		},
		plugins: { states: { 'mp.other': false } },
		'unbound::cache': { modules: {} },
	};

	test('points the loader at the bench server and enables the plugins, keeping the rest', () => {
		expect(
			benchSettings(current, 'http://bench:3110/unbound.bundle', ['unbound.moyai']),
		).toEqual({
			unbound: {
				loader: { update: { url: 'http://bench:3110/unbound.bundle', hmr: false } },
				debugger: { enabled: true, address: 'dev:9091' },
			},
			plugins: { states: { 'mp.other': false, 'unbound.moyai': true } },
			'unbound::cache': { modules: {} },
		});
		expect(current.unbound.loader.update.url).toBe('http://dev:3100/unbound.bundle');
	});

	test('empties only the module cache for a cold launch', () => {
		expect(Object.keys(withoutModuleCache(current))).toEqual(['unbound', 'plugins']);
	});
});

describe('vphone lock', () => {
	test('takes a free lock and frees it on release', async () => {
		const dir = lockDir();
		const release = await acquireLock(new AbortController().signal, () => {}, dir);

		release();
		const again = await acquireLock(new AbortController().signal, () => {}, dir);

		again();
	});

	test('waits while another agent holds the lock, reporting who', async () => {
		const dir = lockDir();
		const holders: string[] = [];

		mkdirSync(dir);
		writeFileSync(join(dir, 'owner'), 'lazy-core\n');
		const controller = new AbortController();
		const waiting = acquireLock(controller.signal, (owner) => holders.push(owner), dir);

		controller.abort();
		const stopped = await waiting.then(
			() => undefined,
			(error: Error) => error,
		);

		expect(stopped).toBeInstanceOf(Error);
		expect(holders).toEqual(['lazy-core']);
	});

	test('takes over a lock left by a bench run whose process is gone, never one another agent holds', () => {
		expect(isStaleBenchLock('unbound-bench pid=999999 2026-11-01T06:00:00Z', () => false)).toBe(
			true,
		);
		expect(isStaleBenchLock('unbound-bench pid=42 2026-11-01T06:00:00Z', () => true)).toBe(
			false,
		);
		expect(isStaleBenchLock('lazy-core', () => false)).toBe(false);
	});
});

describe('parseDotEnv', () => {
	test('reads KEY=value lines, unquoting values and skipping comments', () => {
		expect(
			parseDotEnv('# note\nDEV_HOST=100.65.233.54\nUNBOUND_BRIDGE_PORT="9091"\n\n'),
		).toEqual({
			DEV_HOST: '100.65.233.54',
			UNBOUND_BRIDGE_PORT: '9091',
		});
	});
});
