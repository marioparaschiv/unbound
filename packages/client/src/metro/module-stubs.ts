import { createLogger } from '@unbound-app/logger';

import { createSentryStub } from '~/metro/sentry-stub';
import type { MetroFactory } from '~/metro/capture';

const Logger = createLogger('Metro', 'Stubs');

/** The module ids found on an earlier launch of the same Discord build, in the Unbound folder. */
const STUBS_FILE = 'metro-stubs.json';

type StoredStubs = {
	fingerprint: string;
	ids: Record<string, number>;
	/** Modules the stubbed SDK was first to require, React among them; the stub requires them in its place. */
	requires?: number[];
};

type ClientInfo = {
	Build?: string;
	OTABuild?: string;
	getConstants?: () => ClientInfo;
};

type NativeModuleProxyGlobal = typeof globalThis & {
	nativeModuleProxy?: Record<string, ClientInfo | undefined>;
};

// Unbound's `preinitialize` reads React and React Native right after Discord's main module, so they must have run.
function createSentryFactory(requires: readonly number[]): MetroFactory {
	return (_, metroRequire, ___, ____, module) => {
		for (let i = 0, len = requires.length; i < len; i++) {
			metroRequire(requires[i]);
		}

		module.exports = createSentryStub();
	};
}

// The ids of the modules `preinitialize` found, which the real SDK may have been first to require.
function preinitializedIds(): number[] {
	const wanted = [globalThis.React, globalThis.ReactNative].filter(Boolean);
	const ids: number[] = [];

	for (const [id, module] of globalThis.modules) {
		if (wanted.includes(module.publicModule?.exports)) {
			ids.push(id);
		}

		if (ids.length === wanted.length) {
			break;
		}
	}

	return ids;
}

// Module ids are fixed per bundle, so the build, OTA build and module count name one bundle.
function fingerprint(): string | undefined {
	try {
		const info = (globalThis as NativeModuleProxyGlobal).nativeModuleProxy
			?.NativeClientInfoModule;
		const constants = info?.getConstants?.() ?? info;

		if (!constants?.Build) {
			return undefined;
		}

		return `${constants.Build}:${constants.OTABuild ?? ''}:${globalThis.modules?.size ?? 0}`;
	} catch (error) {
		Logger.error('Failed to read the Discord build for module stubs:', error);

		return undefined;
	}
}

function isStoredStubs(value: unknown): value is StoredStubs {
	if (typeof value !== 'object' || value === null) {
		return false;
	}

	const { fingerprint, ids, requires = [] } = value as Partial<StoredStubs>;

	return (
		typeof fingerprint === 'string' &&
		typeof ids === 'object' &&
		ids !== null &&
		Array.isArray(requires) &&
		requires.every((id) => typeof id === 'number')
	);
}

// Set once this launch has stubbed or recorded, so `recordModuleStub` stops looking.
let settled = false;
let stubs: Map<number, MetroFactory> | undefined;

function loadStubs(): Map<number, MetroFactory> {
	const loaded = new Map<number, MetroFactory>();
	const current = fingerprint();
	const text = current ? globalThis.NativePlatform?.files?.read?.(STUBS_FILE) : undefined;

	if (!text) {
		return loaded;
	}

	try {
		const stored: unknown = JSON.parse(text);

		if (!isStoredStubs(stored) || stored.fingerprint !== current) {
			return loaded;
		}

		const sentry = stored.ids.sentry;

		if (typeof sentry === 'number') {
			loaded.set(sentry, createSentryFactory(stored.requires ?? []));
			settled = true;
		}
	} catch (error) {
		Logger.error(`Failed to parse module stubs ${STUBS_FILE}:`, error);
	}

	return loaded;
}

/**
 * @description Finds the stand-in factory for a module, when an earlier launch of this Discord build found its id.
 * The first call reads the stubs file; later calls are one map lookup.
 * @param id The module Metro is about to run.
 * @returns The stub factory, or `undefined` to run the module's own.
 */
export function resolveModuleStub(id: number): MetroFactory | undefined {
	stubs ??= loadStubs();

	return stubs.get(id);
}

/**
 * @description Records the id of Discord's Sentry SDK the first time it loads, so later launches of the build stub it.
 * Runs after `preinitialize`, so it also records the React and React Native ids the stub must require.
 * @param exports The module's exports.
 * @param id The module's id.
 */
export function recordModuleStub(exports: MetroExport, id: number): void {
	if (settled || !exports.ReactNativeClient || !exports.nativeCrash) return;

	settled = true;

	const current = fingerprint();

	if (!current) return;

	const stored: StoredStubs = {
		fingerprint: current,
		ids: { sentry: id },
		requires: preinitializedIds(),
	};

	try {
		globalThis.NativePlatform?.files?.write?.(STUBS_FILE, JSON.stringify(stored));
	} catch (error) {
		Logger.error(`Failed to write module stubs ${STUBS_FILE}:`, error);
	}
}
