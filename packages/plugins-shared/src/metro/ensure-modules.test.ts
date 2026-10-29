import { describe, expect, mock, test } from 'bun:test';

type Presence = 'loaded' | 'present' | 'missing' | 'unknown';

const presences = new WeakMap<object, Presence>();

mock.module('@unbound-app/api', () => ({
	metro: { getModulePresence: (handle: object) => presences.get(handle) },
}));

const { ensureModules } = await import('./ensure-modules');

// A lazy handle whose `module` read would load its module, which `ensureModules` must never do.
function lazy(presence: Presence | undefined, module?: { value: number }) {
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

		expect(ensureModules('Test', { native })).toBe(true);
	});

	test('accepts a lazy handle unless its module is known missing, without reading it', () => {
		const handles = {
			loaded: lazy('loaded'),
			present: lazy('present'),
			unknown: lazy('unknown'),
			missing: lazy('missing'),
		};

		expect(ensureModules('Test', { loaded: handles.loaded.handle })).toBe(true);
		expect(ensureModules('Test', { present: handles.present.handle })).toBe(true);
		expect(ensureModules('Test', { unknown: handles.unknown.handle })).toBe(true);
		expect(ensureModules('Test', { missing: handles.missing.handle })).toBe(false);
		expect(Object.values(handles).flatMap(({ reads }) => reads)).toEqual([]);
	});

	test('resolves a lazy handle that cannot wait', () => {
		expect(ensureModules('Test', { found: lazy(undefined, { value: 1 }).handle })).toBe(true);
		expect(ensureModules('Test', { missing: lazy(undefined).handle })).toBe(false);
	});

	test('rejects missing handles', () => {
		expect(ensureModules('Test', { missing: undefined })).toBe(false);
	});
});
