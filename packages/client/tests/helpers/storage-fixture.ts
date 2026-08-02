import { mock } from 'bun:test';

import { defineGlobal, installSubstrateMocks } from './metro-fixture';

// Storage test substrate. Carries only what `~/api/storage` touches at eval - the
// `globalThis.UNBOUND_SETTINGS` root it snapshots into a module-level const, and the `~/api/fs`
// module its debounced `persist` writes through. It models no disk, no encoding and no React.

/** The in-memory settings root, keyed by store name then by key path. */
export type SettingsRoot = Record<string, Record<string, unknown>>;

/** One captured `fs.write` call, in invocation order. */
export interface FsWrite {
	path: string;
	payload: string;
}

/** The recorder handed back by `installFsRecorder`, capturing every write `persist` performs. */
export interface FsRecorder {
	writes: FsWrite[];
	reset(): void;
}

/**
 * @description Defines the settings root `~/api/storage` reads at eval. Must run before the dynamic
 * `import()` of the unit under test, which snapshots the global into a const it never re-reads.
 * @param seed The initial settings contents.
 * @returns The installed root, so a test can inspect the object storage actually mutates.
 */
export function installStorageGlobals(seed: SettingsRoot = {}): SettingsRoot {
	defineGlobal<SettingsRoot>('UNBOUND_SETTINGS', seed);
	installSubstrateMocks();

	return seed;
}

/**
 * @description Replaces `~/api/fs` with a stub that records write paths and payloads instead of
 * touching the native file manager. Call this *after* `installStorageGlobals`, whose substrate mocks
 * register their own inert `~/api/fs` and would otherwise overwrite the recorder.
 * @returns A recorder exposing the captured writes and a reset for per-test isolation.
 */
export function installFsRecorder(): FsRecorder {
	const writes: FsWrite[] = [];

	mock.module('~/api/fs', () => ({
		default: {
			Documents: '/docs',
			write: async (path: string, payload: string) => void writes.push({ path, payload }),
			read: async () => '',
			rm: async () => true,
			exists: async () => false,
		},
	}));

	return {
		writes,
		reset: () => void (writes.length = 0),
	};
}

export default { installStorageGlobals, installFsRecorder };
