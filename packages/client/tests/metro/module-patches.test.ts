// Untested by design - these branch on Discord bundle facts that drift between builds; a green test
// would only assert the code restates its own assumption:
//   - the `id + 1` RTN-profiler blacklisting (index.ts ~190-197),
//   - the `IntlMessagesProxy` string check (index.ts ~721),
//   - byStore's `_dispatcher`/`getName()` payload shape (filters.ts ~107).
// This file covers only the container-contract patches: the `requireNativeComponent` name, the
// `fileFinishedImporting` import-tracker hook, and the once-only idempotency of each wrap.

import { describe, expect, test } from 'bun:test';

import { installMetroGlobals } from '../helpers/metro-fixture';

let nativeCalls = 0;
let trackerReturn: unknown;

installMetroGlobals({
	modules: {
		1: {
			factory: (_g, _r, _d, _a, moduleObject) => {
				moduleObject.exports = {
					default: function requireNativeComponent(..._args: unknown[]) {
						nativeCalls++;
						throw new Error('native lookup failed');
					},
				};
			},
		},
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

// Initialise both so the import-time-wrapped factories run and the patches apply.
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

		const before = mod1.default;
		Metro.initializeModule(1);
		expect(window.modules.get(1)!.publicModule.exports.default).toBe(before);
	});
});

describe('fileFinishedImporting tracker', () => {
	test('stamps __filePath on the importing module and passes the return through', () => {
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
