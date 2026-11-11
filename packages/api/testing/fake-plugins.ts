import type { AddonAuthor, AddonHandle, AddonManifest } from '../src/global';
import type { FakeModule } from './fake-metro';

/** What a test sets about an installed plugin; the rest reads as a started, enabled plugin. */
export type PluginSpec = {
	name?: string;
	version?: string;
	authors?: AddonAuthor[];
	/** Whether the user has it enabled. Defaults to true. */
	enabled?: boolean;
	/** Whether it is running. Defaults to whether it is enabled and has not failed. */
	started?: boolean;
	/** The error it failed to start with; sets `failed` and shows in `plugins.errors`. */
	error?: Error;
};

/** The fake `plugins`, its installed plugins, and what sets them. */
export type FakePlugins = {
	namespace: FakeModule;
	/** Adds an installed plugin, or changes the one with this id. */
	set: (id: string, spec?: PluginSpec) => void;
	/** Removes an installed plugin. */
	remove: (id: string) => void;
	/** Puts back the plugin under test alone, started and enabled. */
	reset: () => void;
};

type State = Required<Pick<PluginSpec, 'name' | 'version' | 'authors' | 'enabled'>> &
	Pick<PluginSpec, 'started' | 'error'>;

/**
 * @description Creates the fake `plugins`: the plugin under test is installed, started and enabled, and a test adds others.
 * `enable`, `disable`, `toggle`, `start` and `stop` change the state the handles report; `install`, `reload` and `update` settle at once and change nothing.
 * @param own The manifest of the plugin under test.
 * @returns The fake.
 */
export function createFakePlugins(own: AddonManifest): FakePlugins {
	const states = new Map<string, State>();
	const handles = new Map<string, AddonHandle>();
	const errors = new Map<PropertyKey, Error>();
	const addons = new Map<PropertyKey, AddonHandle>();
	const startDurations = new Map<string, number>();

	function stateOf(id: string): State | undefined {
		return states.get(id);
	}

	function isRunning(state: State): boolean {
		return state.started ?? (state.enabled && !state.error);
	}

	function handleOf(id: string, manifest?: AddonManifest): AddonHandle {
		function state(): State {
			const found = stateOf(id);

			if (!found) {
				throw new Error(`Failed to read plugin ${id}: it is no longer installed.`);
			}

			return found;
		}
		const built: AddonManifest = manifest ?? {
			...own,
			id,
			name: state().name,
			version: state().version,
			authors: state().authors,
		};

		return {
			id,
			get name() {
				return state().name;
			},
			get version() {
				return state().version;
			},
			get authors() {
				return state().authors;
			},
			manifest: built,
			get started() {
				return isRunning(state());
			},
			get failed() {
				return state().error !== undefined;
			},
			isEnabled: () => state().enabled,
			isPlugin: () => true,
			enable: () => enable(id),
			disable: () => disable(id),
			reload: async () => {},
			toJSON: () => built,
		};
	}

	function set(id: string, spec: PluginSpec = {}) {
		const previous = stateOf(id);

		states.set(id, {
			name: spec.name ?? previous?.name ?? id,
			version: spec.version ?? previous?.version ?? '1.0.0',
			authors: spec.authors ?? previous?.authors ?? [],
			enabled: spec.enabled ?? previous?.enabled ?? true,
			started: 'started' in spec ? spec.started : previous?.started,
			error: 'error' in spec ? spec.error : previous?.error,
		});

		if (!handles.has(id)) {
			const handle = handleOf(id, id === own.id ? own : undefined);

			handles.set(id, handle);
			addons.set(id, handle);
		}

		const error = stateOf(id)?.error;

		if (error) {
			errors.set(id, error);
		} else {
			errors.delete(id);
		}
	}

	function remove(id: string) {
		states.delete(id);
		handles.delete(id);
		addons.delete(id);
		errors.delete(id);
	}

	function update(id: string, change: Partial<State>) {
		const state = stateOf(id);

		if (state) {
			states.set(id, { ...state, ...change });
		}
	}

	function enable(id: string) {
		update(id, { enabled: true, started: undefined });
	}

	function disable(id: string) {
		update(id, { enabled: false, started: false });
	}

	function reset() {
		for (const id of Array.from(states.keys())) remove(id);

		startDurations.clear();
		set(own.id, { name: own.name, version: own.version, authors: own.authors });
	}

	reset();

	const namespace: FakeModule = {
		addons,
		errors,
		startDurations,
		get: (id: string) => handles.get(id),
		getAll: () => [...handles.values()],
		isEnabled: (id: string) => stateOf(id)?.enabled ?? false,
		enable,
		disable,
		toggle: (id: string) => (stateOf(id)?.enabled ? disable(id) : enable(id)),
		start: (id: string) => update(id, { started: true }),
		stop: (id: string) => update(id, { started: false }),
		uninstall: async (id: string) => remove(id),
		install: async () => undefined,
		reload: async () => ({ ok: true }),
		update: async () => false,
	};

	return { namespace, set, remove, reset };
}
