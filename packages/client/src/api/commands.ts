/**
 * @description Slash commands for plugins and built-ins. `createCommands(owner)` returns a handle that registers
 * commands in Discord's `/` picker; `option` builds their typed options. This is the public surface behind
 * `unbound.commands` and `@unbound-app/api/commands`.
 */
import type {
	CommandsHandle,
	CommandsOptions,
	CommandTree,
	OptionBuilders,
} from '@unbound-app/types/commands';
import { createLogger } from '@unbound-app/logger';

import { normalize, resolveSection } from '~/lib/commands/normalize';
import { option as builders } from '~/lib/commands/options';
import type { ErasedTree } from '~/lib/commands/normalize';
import { isKnownOwner } from '~/lib/commands/owners';
import { registry } from '~/lib/commands/registry';

export type * from '@unbound-app/types/commands';

const Logger = createLogger('Commands');
const BUILT_IN_OWNER = 'unbound';
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

	function unregisterAll() {
		registry.release(owner);
	}

	return { register, unregisterAll };
}

function warnIfUnowned(owner: string) {
	if (owner === BUILT_IN_OWNER || warned.has(owner) || isKnownOwner(owner)) return;

	warned.add(owner);
	Logger.warn(
		`Commands of "${owner}" are not removed automatically: no plugin has that id. Pass your manifest id, or call unregisterAll() in stop.`,
	);
}

export default { createCommands, option };
