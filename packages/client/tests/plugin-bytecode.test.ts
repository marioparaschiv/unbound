import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { Plugin } from '@unbound-app/types';

import { makeManifest, resetDevice, states } from './helpers/addons';

const { Plugins } = await import('~/managers/plugins');

type Evaluation = [folder: string, bytecodeVersion: number];

let evaluations: Evaluation[];

type CompiledModule = { default: Plugin };

let compiled: (() => CompiledModule) | undefined;

function compiledPlugin(marker: string): Plugin {
	return { start: () => void evaluations.push([marker, 0]), stop: () => {} };
}

function scan(bundle: string) {
	const manifest = { ...makeManifest('bytecode.example'), folder: 'bytecode.example' };

	globalThis.UNBOUND_PLUGINS = [{ manifest, bundle }];
}

beforeEach(() => {
	resetDevice();
	Reflect.set(globalThis, 'window', globalThis);
	Reflect.set(globalThis, 'React', { createElement: () => null });
	states['bytecode.example'] = true;
	evaluations = [];
	compiled = () => ({ default: compiledPlugin('bytecode') });
	globalThis.UNBOUND_LOADER = { origin: 'test', version: '1.0.0', bytecodeVersion: 98 };
	Object.defineProperty(globalThis, 'NativePlatform', {
		configurable: true,
		writable: true,
		value: {
			addons: {
				verify: () => ({ status: 'unsigned' }),
				evaluateBytecode: (folder: string, bytecodeVersion: number) => {
					evaluations.push([folder, bytecodeVersion]);

					return compiled;
				},
			},
		},
	});
});

afterEach(() => {
	globalThis.NativePlatform = undefined;
	globalThis.UNBOUND_PLUGINS = [];
	Reflect.deleteProperty(globalThis, 'React');
	Reflect.deleteProperty(globalThis, 'window');
});

describe('plugin bytecode', () => {
	test('starts a scanned plugin from the bytecode compiled for this runtime', () => {
		scan('({ start() {}, stop() {} })');
		new Plugins().initialize();

		expect(evaluations).toEqual([
			['bytecode.example', 98],
			['bytecode', 0],
		]);
	});

	test('falls back to the source when there is no matching bytecode', () => {
		compiled = undefined;
		scan('({ start() { globalThis.__bytecodeTestSource = true; }, stop() {} })');
		new Plugins().initialize();

		expect(evaluations).toEqual([['bytecode.example', 98]]);
		expect(Reflect.get(globalThis, '__bytecodeTestSource')).toBe(true);
		Reflect.deleteProperty(globalThis, '__bytecodeTestSource');
	});

	test('runs a bundle that differs from the scanned one from source', () => {
		scan('({ start() {}, stop() {} })');
		const plugins = new Plugins();

		plugins.initialize();

		evaluations = [];

		plugins.load(
			'({ start() { globalThis.__bytecodeTestReloaded = true; }, stop() {} })',
			makeManifest('bytecode.example'),
		);

		expect(evaluations).toEqual([]);
		expect(Reflect.get(globalThis, '__bytecodeTestReloaded')).toBe(true);
		Reflect.deleteProperty(globalThis, '__bytecodeTestReloaded');
	});
});
