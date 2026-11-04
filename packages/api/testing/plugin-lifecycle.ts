import type { PatchRecord } from './recording-patcher';
import type { PluginContext } from '../src/native';
import type { StartContext } from './fake-native';

import { getSession } from './session';

type PluginExports = {
	start?: (context: PluginContext) => void | Promise<void>;
	stop?: () => void | Promise<void>;
};

type Held = {
	patches: Set<PatchRecord>;
	commands: Set<string>;
	listeners: number;
	direct: number;
	timers: number;
};

let started: { plugin: PluginExports; context: PluginContext; before: Held } | undefined;

function isPluginExports(value: unknown): value is PluginExports {
	return typeof value === 'object' && value !== null;
}

function held(): Held {
	const { scope, listeners, flux } = getSession();

	return {
		patches: new Set(scope.patcher.patches),
		commands: new Set(scope.commands.registered.keys()),
		listeners: listeners.active().length,
		direct: flux.directListeners().length,
		timers: scope.timers.pending(),
	};
}

async function loadPlugin(): Promise<PluginExports> {
	const { entry, root } = getSession();

	if (!entry) {
		throw new Error(
			`Failed to start the plugin: ${root} has no src/index.tsx or src/index.ts.`,
		);
	}

	const module: unknown = await import(entry);
	const plugin: unknown =
		isPluginExports(module) && 'default' in module ? module.default : module;

	if (!isPluginExports(plugin)) {
		throw new Error(`Failed to start the plugin: ${entry} exports no plugin object.`);
	}

	return plugin;
}

function describe(record: PatchRecord): string {
	const target = Reflect.get(record.target, 'name');

	return `patcher.${record.kind} on ${typeof target === 'string' && target ? `${target}.` : ''}${record.method}`;
}

// What the plugin added since `before` and still holds, as one line each.
function since(before: Held, scopeOnly: boolean): string[] {
	const { scope, listeners, flux } = getSession();

	return [
		...scope.patcher.patches.filter((record) => !before.patches.has(record)).map(describe),
		...[...scope.commands.registered.keys()]
			.filter((name) => !before.commands.has(name))
			.map((name) => `command /${name}`),
		...listeners.active().slice(before.listeners),
		...Array.from(
			{ length: Math.max(scope.timers.pending() - before.timers, 0) },
			() => 'timer',
		),
		...(scopeOnly ? [] : flux.directListeners().slice(before.direct)),
	];
}

/**
 * @description Imports the plugin's entry once and runs its `start` with a `PluginContext`, as the client does when it is enabled.
 * @param context Overrides for the context: its `platform`, `capabilities`, or the `native` bridge members the plugin calls.
 * @returns A promise that settles once `start` has.
 */
export async function startPlugin(context: StartContext = {}): Promise<void> {
	const { native, scope } = getSession();
	const plugin = await loadPlugin();
	const built = native.context(scope.addon.manifest, context);

	started = { plugin, context: built, before: held() };
	await plugin.start?.(built);
}

/**
 * @description Lists what the plugin added since {@link startPlugin} and still holds: patches, commands, listeners and timers.
 * Use it to check a feature undid itself without stopping the plugin, such as after a setting turned it off.
 * @returns One line per thing held; empty when the plugin holds nothing.
 */
export function pluginHolds(): string[] {
	if (!started) {
		throw new Error('Failed to read what the plugin holds: call startPlugin() first.');
	}

	return since(started.before, true);
}

/**
 * @description Runs the plugin's `stop`, then disposes what the plugin scope recorded, as the client does: its patches, commands,
 * listeners and timers. The call rejects, which fails the test, listing what is still held after that, such as a
 * change listener added directly to a Flux store, which Unbound does not remove either.
 * @returns A promise that settles once `stop` has and nothing is left.
 */
export async function stopPlugin(): Promise<void> {
	if (!started) {
		throw new Error('Failed to stop the plugin: call startPlugin() first.');
	}

	const { plugin, context, before } = started;
	const { scope, listeners } = getSession();

	started = void 0;

	try {
		await plugin.stop?.();
	} finally {
		context.dispose();
		scope.patcher.unpatchAll();
		scope.timers.clearAll();
		listeners.clear();
		scope.commands.unregisterAll();
	}

	const leaks = since(before, false);

	if (leaks.length === 0) return;

	throw new Error(
		`${scope.addon.name} left ${leaks.length} thing(s) behind after stop():\n${leaks.map((leak) => `  - ${leak}`).join('\n')}`,
	);
}

/**
 * @description Forgets a started plugin without stopping it. The preset calls it before each test.
 */
export function forgetPlugin(): void {
	started = void 0;
}
