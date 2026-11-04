import type { CommandArgs, LogEntry } from './install-addon-globals';
import type { OpenedDialog, ShownToast } from './fake-feedback';
import type { CommandContext, Reply } from '../src/commands';
import type { PatchRecord } from './recording-patcher';
import type { PluginLocale } from './plugin-types';
import type { FakeModule } from './fake-metro';
import type { FluxAction } from '../src/flux';
import type { StoreSeeds } from './fake-api';

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
	const logs: LogRecorder = {
		get entries() {
			return getSession().scope.logs;
		},
	};

	return { toasts, dialogs, commands, patches, flux, metro, logs };
}

export const { toasts, dialogs, commands, patches, flux, metro, logs } = createRecorders();

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
