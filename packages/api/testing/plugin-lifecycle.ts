import type { PatchRecord } from './recording-patcher';

import { getSession } from './session';

type PluginExports = { start?: () => void | Promise<void>; stop?: () => void | Promise<void> };

type Held = { patches: Set<PatchRecord>; commands: Set<string>; listeners: number };

let started: { plugin: PluginExports; before: Held } | undefined;

function isPluginExports(value: unknown): value is PluginExports {
	return typeof value === 'object' && value !== null;
}

function held(): Held {
	const { scope, listeners } = getSession();

	return {
		patches: new Set(scope.patcher.patches),
		commands: new Set(scope.commands.registered.keys()),
		listeners: listeners.active().length,
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

/**
 * @description Imports the plugin's entry once and runs its `start`, as the client does when it is enabled.
 * @returns A promise that settles once `start` has.
 */
export async function startPlugin(): Promise<void> {
	const plugin = await loadPlugin();

	started = { plugin, before: held() };
	await plugin.start?.();
}

/**
 * @description Runs the plugin's `stop`, then checks it undid what `start` did: every patch, command and listener it
 * added since {@link startPlugin} must be gone. Whatever is left is removed, and the call rejects listing it, which
 * fails the test.
 * @returns A promise that settles once `stop` has and nothing leaked.
 */
export async function stopPlugin(): Promise<void> {
	if (!started) {
		throw new Error('Failed to stop the plugin: call startPlugin() first.');
	}

	const { plugin, before } = started;
	const { scope, listeners } = getSession();

	started = void 0;
	await plugin.stop?.();

	const leaks = [
		...scope.patcher.patches.filter((record) => !before.patches.has(record)).map(describe),
		...[...scope.commands.registered.keys()]
			.filter((name) => !before.commands.has(name))
			.map((name) => `command /${name}`),
		...listeners.active().slice(before.listeners),
	];

	if (leaks.length === 0) return;

	scope.patcher.unpatchAll();
	scope.commands.unregisterAll();
	listeners.clear();

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
