import { createFakeNative, installAddonGlobals } from '@unbound-app/api/testing';
import { describe, expect, mock, test } from 'bun:test';

installAddonGlobals();

type Presence = 'loaded' | 'present' | 'missing' | 'unknown';
type Handle = { __METRO_LAZY__: boolean };
type FakeModule = { value: number };

const presences = new WeakMap<Handle, Presence>();

mock.module('@unbound-app/api', () => ({
	metro: { getModulePresence: (handle: Handle) => presences.get(handle) },
}));

const { ensureModules } = await import('~/metro/ensure-modules');
const { runFeatures } = await import('~/lifecycle/features');

const context = createFakeNative().context(addon.manifest);

// A lazy handle whose `module` read would load its module, which `ensureModules` must never do.
function lazy(presence: Presence | undefined, module?: FakeModule) {
	const reads: string[] = [];
	const handle = new Proxy(
		{ __METRO_LAZY__: true },
		{
			get(_, prop) {
				reads.push(String(prop));

				return prop === 'module' ? module : undefined;
			},
		},
	);

	if (presence) {
		presences.set(handle, presence);
	}

	return { handle, reads };
}

describe('ensureModules', () => {
	test('accepts a native module that answers `in` for every name', () => {
		const native = new Proxy({}, { has: () => true, get: () => undefined });

		expect(ensureModules({ native })).toBe(true);
	});

	test('accepts a lazy handle unless its module is known missing, without reading it', () => {
		const handles = {
			loaded: lazy('loaded'),
			present: lazy('present'),
			unknown: lazy('unknown'),
			missing: lazy('missing'),
		};

		expect(ensureModules({ loaded: handles.loaded.handle })).toBe(true);
		expect(ensureModules({ present: handles.present.handle })).toBe(true);
		expect(ensureModules({ unknown: handles.unknown.handle })).toBe(true);
		expect(ensureModules({ missing: handles.missing.handle })).toBe(false);
		expect(Object.values(handles).flatMap(({ reads }) => reads)).toEqual([]);
	});

	test('names a lazy handle in the self test until it loads its module', () => {
		const { handle } = lazy('present');
		const plugin = runFeatures([
			() => void ensureModules({ MessageStore: handle, Theme: lazy('loaded').handle }),
		]);

		plugin.start(context);
		expect(plugin.selfTest()).toEqual({
			ok: true,
			detail: '1 feature applied, waiting for MessageStore',
		});

		presences.set(handle, 'loaded');
		expect(plugin.selfTest()).toEqual({ ok: true, detail: '1 feature applied' });
	});

	test('resolves a lazy handle that cannot wait', () => {
		expect(ensureModules({ found: lazy(undefined, { value: 1 }).handle })).toBe(true);
		expect(ensureModules({ missing: lazy(undefined).handle })).toBe(false);
	});

	test('rejects missing handles', () => {
		expect(ensureModules({ missing: undefined })).toBe(false);
	});
});
