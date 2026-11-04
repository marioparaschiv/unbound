import type { NativePluginCapability, NativePluginPlatform } from '../src/native';
import type { CommandArgs, LogEntry } from './install-addon-globals';
import type { OpenedDialog, ShownToast } from './fake-feedback';
import type { CommandContext, Reply } from '../src/commands';
import type { NativeCall } from './fake-native-bridge';
import type { PatchRecord } from './recording-patcher';
import type { PluginLocale } from './plugin-types';
import type { PluginSpec } from './fake-plugins';
import type { FakeModule } from './fake-metro';
import type { FluxAction } from '../src/flux';
import type { StoreSeeds } from './fake-api';
import type { FakeJava } from './fake-java';
import type { FakeObjc } from './fake-objc';

import { getSession } from './session';

/** Every toast the plugin showed this test, in order. */
export type ToastRecorder = { readonly shown: readonly ShownToast[] };

/** Every dialog the plugin opened this test, in order, each with `respond` to answer it. */
export type DialogRecorder = { readonly opened: readonly OpenedDialog[] };

/** The plugin's registered commands, and `run` to call one as Discord would. */
export type CommandRecorder = {
	readonly registered: ReadonlyMap<string, object>;
	/** Runs `/path` with parsed `args`, in a guild text channel unless `context` says otherwise. */
	run: (path: string, args?: CommandArgs, context?: Partial<CommandContext>) => Promise<Reply>;
};

/** The patches the plugin holds right now, each with its kind, target and method. */
export type PatchRecorder = { readonly applied: readonly PatchRecord[] };

/** The fake Flux: the actions the plugin dispatched, and the stores a test seeds. */
export type FluxRecorder = {
	readonly dispatched: readonly FluxAction[];
	/** Adds stores, or replaces a seeded store's methods and tells its readers. */
	seed: (stores: StoreSeeds) => void;
	/** Calls a seeded store's change listeners. */
	emit: (name: string) => void;
	/** Sends an action to the plugin's interceptors and listeners. */
	dispatch: (action: FluxAction) => Promise<void>;
};

/** The fake metro's modules: `register` one for the plugin to find, such as `{ sendMessage }`. */
export type MetroRecorder = { register: (module: FakeModule, path?: string) => void };

/** The fake `native`: the platform `definePlatform` selects by, and the modules and capabilities it reports. */
export type NativeRecorder = {
	/** Switches the host platform, `ios` until set; `definePlatform` and `Platform.OS` follow it. */
	setPlatform: (platform: NativePluginPlatform) => void;
	/** Gives `getNativeModule(name)` a module to return. */
	// UNKNOWN: a native module has whatever shape the plugin reads.
	registerModule: (name: string, module: unknown) => void;
	/** Sets what `native.has` reports. */
	setCapabilities: (capabilities: NativePluginCapability[]) => void;
	/** The Objective-C bridge a plugin gets on iOS: register classes and objects for its calls to reach. */
	readonly objc: FakeObjc;
	/** The Java bridge a plugin gets on Android: register classes and objects for its calls to reach. */
	readonly java: FakeJava;
	/** Every `objc`, `java` and `hooks` call the plugin made this test, in order. */
	readonly calls: readonly NativeCall[];
};

/** The plugins the fake `plugins` lists: the plugin under test is there, started; a test sets the others. */
export type PluginRecorder = {
	/** Adds an installed plugin, or changes the one with this id; `plugins.get(id)` reads it. */
	set: (id: string, spec?: PluginSpec) => void;
	/** Removes an installed plugin. */
	remove: (id: string) => void;
};

/** The fake `fs`: its in-memory files, by absolute path; a test may read, add or remove them. */
export type FsRecorder = { readonly files: Map<string, string> };

/** Every line the plugin's `logger` received this test. */
export type LogRecorder = { readonly entries: readonly LogEntry[] };

// Each recorder reads the session on every access, so it always shows the current test's fakes.
function createRecorders() {
	const toasts: ToastRecorder = {
		get shown() {
			return getSession().toasts.shown;
		},
	};
	const dialogs: DialogRecorder = {
		get opened() {
			return getSession().dialogs.opened;
		},
	};
	const commands: CommandRecorder = {
		get registered() {
			return getSession().scope.commands.registered;
		},
		run: (path, args, context) => getSession().scope.commands.run(path, args, context),
	};
	const patches: PatchRecorder = {
		get applied() {
			return getSession().scope.patcher.patches;
		},
	};
	const flux: FluxRecorder = {
		get dispatched() {
			return getSession().flux.dispatched;
		},
		seed: (stores) => getSession().flux.seed(stores),
		emit: (name) => getSession().flux.emit(name),
		dispatch: (action) => getSession().flux.dispatch(action),
	};
	const metro: MetroRecorder = {
		register: (module, path) => getSession().scope.metro.register(module, path),
	};
	const native: NativeRecorder = {
		setPlatform: (platform) => void (getSession().native.state.platform = platform),
		registerModule: (name, module) => void getSession().native.state.modules.set(name, module),
		setCapabilities: (capabilities) =>
			void (getSession().native.state.capabilities = capabilities),
		get objc() {
			return getSession().native.objc;
		},
		get java() {
			return getSession().native.java;
		},
		get calls() {
			return getSession().native.calls;
		},
	};
	const plugins: PluginRecorder = {
		set: (id, spec) => getSession().plugins.set(id, spec),
		remove: (id) => getSession().plugins.remove(id),
	};
	const fs: FsRecorder = {
		get files() {
			return getSession().fs.files;
		},
	};
	const logs: LogRecorder = {
		get entries() {
			return getSession().scope.logs;
		},
	};

	return { toasts, dialogs, commands, patches, flux, metro, native, plugins, fs, logs };
}

export const { toasts, dialogs, commands, patches, flux, metro, native, plugins, fs, logs } =
	createRecorders();

/**
 * @description Switches the locale `@unbound-app/i18n` reads, re-rendering every mounted component that reads it.
 * A code the plugin ships no file for reads en-US, as on device. The preset puts en-US back before each test.
 * @param code The locale code, such as `de`.
 */
export function setLocale(code: PluginLocale): void {
	const { locales } = getSession();

	if (!locales) {
		throw new Error('Failed to set the locale: the plugin has no i18n/en-US.json.');
	}

	locales.setLocale(String(code));
}

/**
 * @description Adds members to a fake of `@unbound-app/api`, so the plugin reads them. `mock.module('@unbound-app/api')` in a test
 * replaces the whole module instead, dropping every fake the preset installed.
 * @param path The namespace, or a nested one with dots, such as `ui` or `metro.components`.
 * @param members The members to add or replace.
 */
export function extendApi(path: string, members: FakeModule): void {
	let target: unknown = getSession().scope.unbound;

	for (const name of path.split('.')) {
		target = typeof target === 'object' && target !== null ? Reflect.get(target, name) : void 0;
	}

	if (typeof target !== 'object' || target === null) {
		throw new Error(
			`Failed to extend @unbound-app/api ${path}: the fake has no such namespace.`,
		);
	}

	Object.assign(target, members);
}
