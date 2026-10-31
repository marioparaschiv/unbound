import type { AddonHandle, AddonLogger, AddonManifest } from '../src/global';
import type { CommandTree } from '../src/commands';

import { createRecordingPatcher, type RecordingPatcher } from './recording-patcher';
import { createFakeMetro, type FakeMetro, type FakeModule } from './fake-metro';
import { createMemoryStorage, type MemoryStorage } from './memory-storage';
import { createFakeReact, type FakeReact } from './fake-react';

type LogLevel = keyof AddonLogger;

/** A line the fake `logger` received. */
export type LogEntry = {
	level: LogLevel;
	args: unknown[];
};

/** The fake `commands`: register records each command tree by its root names. */
export type FakeCommands = {
	/** The registered command trees, by root name. */
	registered: Map<string, object>;
	register: <T>(commands: CommandTree<T>) => () => void;
	unregister: (name: string) => void;
	unregisterAll: () => void;
};

/** The fake `unbound`: the scoped namespaces the kit fakes, plus any a test adds. */
export type FakeUnbound = {
	storage: MemoryStorage;
	patcher: RecordingPatcher;
	metro: FakeMetro;
	commands: FakeCommands;
	[namespace: string]: FakeModule;
};

type InstallOptions = {
	/** The manifest the fake `addon` reads; `id` also names the default Bucket. */
	manifest?: Partial<AddonManifest>;
	/** Namespaces to add to or replace on `unbound`, such as `assets` or `fs`. */
	unbound?: Partial<FakeUnbound>;
};

/** The installed fake Addon scope, and `uninstall` to restore the previous globals. */
export type InstalledAddonGlobals = {
	React: FakeReact;
	unbound: FakeUnbound;
	addon: AddonHandle;
	patcher: RecordingPatcher;
	logger: AddonLogger;
	commands: FakeCommands;
	/** Every line `logger` received, in order. */
	logs: LogEntry[];
	storage: MemoryStorage;
	metro: FakeMetro;
	uninstall: () => void;
};

const LOG_LEVELS: LogLevel[] = ['log', 'info', 'success', 'warn', 'error', 'debug'];

function createLogger(logs: LogEntry[]): AddonLogger {
	const entries = LOG_LEVELS.map((level) => [
		level,
		(...args: unknown[]) => void logs.push({ level, args }),
	]);

	return Object.fromEntries(entries) as AddonLogger;
}

function createCommands(): FakeCommands {
	const registered: FakeCommands['registered'] = new Map();

	return {
		registered,
		register(commands) {
			const roots = Object.keys(commands);

			for (const root of roots) registered.set(root, Reflect.get(commands, root));

			return () => {
				for (const root of roots) registered.delete(root);
			};
		},
		unregister: (name) => void registered.delete(name),
		unregisterAll: () => registered.clear(),
	};
}

function createAddon(manifest: AddonManifest): AddonHandle {
	let enabled = true;

	return {
		id: manifest.id,
		name: manifest.name,
		version: manifest.version,
		authors: manifest.authors,
		manifest,
		data: manifest,
		started: true,
		failed: false,
		instance: null,
		bundle: '',
		isEnabled: () => enabled,
		isPlugin: () => true,
		enable: () => void (enabled = true),
		disable: () => void (enabled = false),
		reload: async () => {},
		toJSON: () => manifest,
	};
}

/**
 * @description Installs a fake Addon scope on `globalThis`, so plugin code under test reads `addon`, `patcher`,
 * `logger`, `commands`, `unbound` and `React` as it would on device. Pass `unbound` to `mock.module('@unbound-app/api')`.
 * @param options The fake addon's manifest and extra `unbound` namespaces.
 * @returns The globals, the recorded logs, and `uninstall` to restore what was there before.
 */
export function installAddonGlobals(options: InstallOptions = {}): InstalledAddonGlobals {
	const manifest: AddonManifest = {
		id: 'test-addon',
		name: 'Test Addon',
		description: '',
		authors: [],
		main: 'index.js',
		version: '1.0.0',
		...options.manifest,
	};
	const logs: LogEntry[] = [];
	const storage = createMemoryStorage(manifest.id);
	const patcher = createRecordingPatcher();
	const metro = createFakeMetro();
	const commands = createCommands();
	const unbound: FakeUnbound = { storage, patcher, metro, commands, ...options.unbound };
	const globals = {
		React: createFakeReact(),
		unbound,
		addon: createAddon(manifest),
		patcher,
		logger: createLogger(logs),
		commands,
	};
	const previous = new Map<string, PropertyDescriptor | undefined>();

	for (const [name, value] of Object.entries(globals)) {
		previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
		Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
	}

	function uninstall() {
		for (const [name, descriptor] of previous) {
			if (descriptor) {
				Object.defineProperty(globalThis, name, descriptor);
			} else {
				Reflect.deleteProperty(globalThis, name);
			}
		}
	}

	return { ...globals, logs, storage, metro, uninstall };
}
