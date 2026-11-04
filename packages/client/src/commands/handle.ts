import type { CommandsHandle, CommandsOptions, CommandTree } from '@unbound-app/types/commands';
import { createLogger } from '@unbound-app/logger';

import { CommandDefinitionError, normalize, resolveSection } from '~/commands/normalize';
import type { CommandLocales } from '~/commands/locales';
import type { ErasedTree } from '~/commands/normalize';
import { isKnownOwner } from '~/commands/owners';
import { registry } from '~/commands/registry';

/** Reads an owner's locales when it registers; `undefined` while it has none, such as a plugin without `i18n/`. */
export type LocalesGetter = () => CommandLocales | undefined;

const Logger = createLogger('Commands');
const BUILT_IN_OWNER = 'unbound';

/** The owner of commands added through the namespace's own `register`. */
export const NAMESPACE_OWNER = 'unbound::namespace';
const warned = new Set<string>();

/**
 * @description Creates the commands handle for one owner, whose message keys resolve through `getLocales`.
 * Its commands follow locale changes from their first register until `unregisterAll`.
 * @param owner The plugin id, `'unbound'` for a built-in, or the namespace owner.
 * @param options The owner's own picker section; omitted, the shared Unbound section.
 * @param getLocales Reads the owner's translations.
 * @returns The handle.
 */
export function createOwnerCommands(
	owner: string,
	options: CommandsOptions,
	getLocales: LocalesGetter,
): CommandsHandle {
	if (typeof owner !== 'string' || !owner.trim()) {
		throw new Error('createCommands needs an owner id: the plugin id, or "unbound".');
	}

	const section = resolveSection(owner, options.section);
	let stopFollowing: (() => void) | undefined;

	function register<T>(tree: CommandTree<T>): () => void {
		warnIfUnowned(owner);

		const locales = getLocales();

		if (!locales) {
			throw new CommandDefinitionError(
				owner,
				Object.keys(tree).join(', '),
				'the plugin has no translations. Add i18n/en-US.json with a key for each description.',
			);
		}

		const remove = registry.add(
			owner,
			normalize({ owner, section, locales, tree: tree as ErasedTree }),
		);

		stopFollowing ??= locales.subscribe(() => registry.refresh(owner));

		return remove;
	}

	function unregister(name: string) {
		registry.remove(owner, name);
	}

	function unregisterAll() {
		registry.release(owner);
		stopFollowing?.();
		stopFollowing = undefined;
	}

	return { register, unregister, unregisterAll };
}

function warnIfUnowned(owner: string) {
	if (
		owner === BUILT_IN_OWNER ||
		owner === NAMESPACE_OWNER ||
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

export default { createOwnerCommands };
