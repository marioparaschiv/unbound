import type {
	BuilderInput,
	ChoiceInput,
	ChoiceMap,
	CommandContext,
	OptionBuilder,
	OptionSettings,
	OptionSpec,
	CommandTree,
	OptionBuilders,
	OptionKind,
	OptionValue,
	Reply,
} from '../src/commands';
import type { AddonHandle, AddonLogger, AddonManifest } from '../src/global';

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

/** A command's parsed options, by name, as its `execute` receives them. */
export type CommandArgs = Record<string, OptionValue<OptionKind> | undefined>;

/** The fake `commands`: register records each command tree by its root names. */
export type FakeCommands = {
	/** The registered command trees, by root name. */
	registered: Map<string, object>;
	register: <T>(commands: CommandTree<T>) => () => void;
	unregister: (name: string) => void;
	unregisterAll: () => void;
	/** The option builders; each returns its kind and settings. */
	option: OptionBuilders;
	/**
	 * Runs a registered command as Discord would, with parsed args.
	 * @param path The command's name, with its subcommands after spaces, such as `'star'` or `'tags add'`.
	 * @param args The parsed options, such as `{ user }`.
	 * @param context Where it runs; a guild text channel when omitted.
	 */
	run: (path: string, args?: CommandArgs, context?: Partial<CommandContext>) => Promise<Reply>;
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

const DEFAULT_CONTEXT: CommandContext = {
	channel: { id: '100000000000000001', type: 0, name: 'general', guild_id: '100000000000000002' },
	guild: { id: '100000000000000002', name: 'Test Guild' },
};

// Builds the spec the client's builders return: the kind, `required`, `description` and the kind's settings.
function spec<K extends OptionKind>(kind: K): OptionBuilder<K> {
	return <const R extends boolean = false>(input: BuilderInput<K, R> = {}) => ({
		kind,
		required: (input.required ?? false) as R,
		description: input.description,
		settings: input,
		choices: undefined,
	});
}

// `choice` maps each value to its label's key; its typed `M` exists only for inference.
function choice<const M extends ChoiceMap, const R extends boolean = false>(
	choices: M,
	settings: ChoiceInput<R> = {},
): OptionSpec<'string', R, keyof M & string> {
	const none: OptionSettings<'string'> = {};

	return {
		kind: 'string',
		required: (settings.required ?? false) as R,
		description: settings.description,
		settings: none,
		choices,
	};
}

function createOptionBuilders(): OptionBuilders {
	return {
		string: spec('string'),
		integer: spec('integer'),
		number: spec('number'),
		boolean: spec('boolean'),
		user: spec('user'),
		channel: spec('channel'),
		role: spec('role'),
		choice,
	};
}

function findCommand(registered: FakeCommands['registered'], path: string) {
	const [root = '', ...rest] = path.split(' ').filter(Boolean);
	let node: unknown = registered.get(root);

	for (const name of rest) {
		const subcommands: unknown = node ? Reflect.get(node, 'subcommands') : void 0;

		node = subcommands ? Reflect.get(subcommands, name) : void 0;
	}

	const execute: unknown = node ? Reflect.get(node, 'execute') : void 0;

	if (typeof execute !== 'function') {
		throw new Error(
			`Failed to run command /${path}: it is not registered. Registered: ${[...registered.keys()].join(', ') || 'none'}.`,
		);
	}

	return { node, execute };
}

function createCommands(): FakeCommands {
	const registered: FakeCommands['registered'] = new Map();

	return {
		registered,
		option: createOptionBuilders(),
		async run(path, args = {}, context = {}) {
			const { node, execute } = findCommand(registered, path);

			return execute.call(node, args, { ...DEFAULT_CONTEXT, ...context });
		},
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
		started: true,
		failed: false,
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
