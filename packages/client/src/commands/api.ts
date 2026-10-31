/**
 * @description Slash commands for plugins and built-ins. `register` adds commands to Discord's `/` picker,
 * `createCommands(owner)` returns a handle for one owner, and `option` builds typed options. This is the public
 * surface behind `unbound.commands` and `@unbound-app/api/commands`.
 */
import type {
	CommandsHandle,
	CommandsOptions,
	CommandTree,
	OptionBuilders,
} from '@unbound-app/types/commands';
import { createLogger } from '@unbound-app/logger';

import { normalize, resolveSection } from '~/commands/normalize';
import { option as builders } from '~/commands/options';
import type { ErasedTree } from '~/commands/normalize';
import { isKnownOwner } from '~/commands/owners';
import { registry } from '~/commands/registry';

export type * from '@unbound-app/types/commands';

const Logger = createLogger('Commands');
const BUILT_IN_OWNER = 'unbound';
// Owns commands registered through the namespace, apart from the built-ins, so `unregister` never removes theirs.
const SHARED_OWNER = 'unbound::shared';
const warned = new Set<string>();

/** Option builders, one per kind: `option.string({ required: true })`, `option.user()`, `option.choice([...])`. */
export const option: OptionBuilders = builders;

/**
 * @description Creates the commands handle for one owner, like `createPatcher` does for patches. A plugin passes
 * its manifest id, so its commands are removed when it stops; a built-in passes `'unbound'`.
 * @param owner The plugin id, or `'unbound'` for a built-in.
 * @param options The owner's own picker section; omitted, the shared Unbound section.
 * @returns The handle.
 */
export function createCommands(owner: string, options: CommandsOptions = {}): CommandsHandle {
	if (typeof owner !== 'string' || !owner.trim()) {
		throw new Error('createCommands needs an owner id: the plugin id, or "unbound".');
	}

	const section = resolveSection(owner, options.section);

	function register<T>(tree: CommandTree<T>): () => void {
		warnIfUnowned(owner);

		return registry.add(owner, normalize({ owner, section, tree: tree as ErasedTree }));
	}

	function unregister(name: string) {
		registry.remove(owner, name);
	}

	function unregisterAll() {
		registry.release(owner);
	}

	return { register, unregister, unregisterAll };
}

const shared = createCommands(SHARED_OWNER);

/**
 * @description Adds commands to the shared Unbound section of the `/` picker. Registering a root name again
 * replaces that whole command; a root name another owner has throws `CommandDefinitionError`.
 * @template T The command tree, inferred from it.
 * @param commands The commands, keyed by root name.
 * @returns A function that removes this call's commands; it is safe to call twice.
 */
export function register<T>(commands: CommandTree<T>): () => void {
	return shared.register(commands);
}

/**
 * @description Removes a root command added with `register`, with its subcommands. Does nothing when there is none.
 * @param name The root command's name.
 */
export function unregister(name: string): void {
	shared.unregister(name);
}

function warnIfUnowned(owner: string) {
	if (
		owner === BUILT_IN_OWNER ||
		owner === SHARED_OWNER ||
		warned.has(owner) ||
		isKnownOwner(owner)
	) {
		return;
	}

	warned.add(owner);
	Logger.warn(
		`Commands of "${owner}" are not removed automatically: no plugin has that id. Pass your manifest id, or call unregisterAll() in stop.`,
	);
}

export default { option, createCommands, register, unregister };
