// Untested by design — these branch on Discord bundle facts that drift between builds; a green test
// would only assert the code restates its own assumption:
//   - the `id + 1` RTN-profiler blacklisting (index.ts ~190-197),
//   - the `IntlMessagesProxy` string check (index.ts ~721),
//   - byStore's `_dispatcher`/`getName()` payload shape (filters.ts ~107).
// This file covers only the container-contract patches: the `requireNativeComponent` name, the
// `fileFinishedImporting` import-tracker hook, and the once-only idempotency of each wrap.

import { describe, expect, test } from 'bun:test';

import { installMetroGlobals } from '../helpers/metro-fixture';

// Each module's factory installs an export whose *name* or *method* triggers one of the container
// patches when the module is required. Names (`requireNativeComponent`, `fileFinishedImporting`) are
// stable RN/Hermes contracts, not Discord facts.
let nativeCalls = 0;
let trackerReturn: unknown;

installMetroGlobals({
	modules: {
		// A `default` export named `requireNativeComponent` that throws — the patch must swallow it.
		1: {
			factory: (_g, _r, _d, _a, moduleObject) => {
				moduleObject.exports = {
					default: function requireNativeComponent(...args: any[]) {
						nativeCalls++;
						throw new Error('native lookup failed');
					},
				};
			},
		},
		// A module exposing `fileFinishedImporting` — the patch wraps it to stamp `__filePath`.
		2: {
			factory: (_g, _r, _d, _a, moduleObject) => {
				moduleObject.exports = {
					fileFinishedImporting: (filePath: string) => {
						trackerReturn = `handled:${filePath}`;
						return trackerReturn;
					},
				};
			},
		},
	},
});

const Metro = await import('~/api/metro');
const { data } = await import('~/api/metro/state');

// Force both modules to initialise so the import-time-wrapped factories run and the patches apply.
Metro.initializeModule(1);
Metro.initializeModule(2);

const mod1 = window.modules.get(1)!.publicModule.exports;
const mod2 = window.modules.get(2)!.publicModule.exports;

describe('requireNativeComponent hardening', () => {
	test('the wrapper swallows a throw and returns the first argument', () => {
		const result = mod1.default('FallbackName', { some: 'config' });

		expect(nativeCalls).toBe(1);
		expect(result).toBe('FallbackName');
	});

	test('patchedNativeRequire latches so the wrap is applied once', () => {
		expect(data.patchedNativeRequire).toBe(true);

		// Re-running the module require must not re-wrap: the export is already our wrapper.
		const before = mod1.default;
		Metro.initializeModule(1);
		expect(window.modules.get(1)!.publicModule.exports.default).toBe(before);
	});
});

describe('fileFinishedImporting tracker', () => {
	test('stamps __filePath on the importing module and passes the return through', () => {
		// A module is mid-import: set the tracked id and give it a record to stamp.
		data.importingModuleId = 2;

		const ret = mod2.fileFinishedImporting(['some', 'path']);

		expect(window.modules.get(2)!.__filePath).toEqual(['some', 'path']);
		expect(ret).toBe('handled:some,path');
	});

	test('does not stamp when there is no importing module (id === -1)', () => {
		data.importingModuleId = -1;
		delete window.modules.get(2)!.__filePath;

		mod2.fileFinishedImporting(['ignored']);

		expect(window.modules.get(2)!.__filePath).toBeUndefined();
	});

	test('patchedImportTracker latches so the hook is installed once', () => {
		expect(data.patchedImportTracker).toBe(true);
	});
});
