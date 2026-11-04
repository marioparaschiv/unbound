import type {
	CommandsHandle,
	CommandsOptions,
	CommandTree,
	OptionBuilders,
} from '@unbound-app/types/commands';

import { createOwnerCommands, NAMESPACE_OWNER } from '~/commands/handle';
import { option as builders } from '~/commands/options';
import { coreLocales } from '~/commands/core-locales';

export type * from '@unbound-app/types/commands';

/** Option builders, one per kind: `option.string({ required: true })`, `option.user()`, `option.choice({ ... })`. */
export const option: OptionBuilders = builders;

/**
 * @description Creates the commands handle for one owner, like `createPatcher` does for patches. A plugin passes
 * its manifest id, so its commands are removed when it stops; a built-in passes `'unbound'`. Text is message keys.
 * @param owner The plugin id, or `'unbound'` for a built-in.
 * @param options The owner's own picker section; omitted, the shared Unbound section.
 * @returns The handle.
 */
export function createCommands(owner: string, options: CommandsOptions = {}): CommandsHandle {
	return createOwnerCommands(owner, options, () => coreLocales);
}

const namespaceCommands = createCommands(NAMESPACE_OWNER);

/**
 * @description Adds commands to the shared Unbound section of the `/` picker. Registering a root name again
 * replaces that whole command; a root name another owner has throws `CommandDefinitionError`.
 * @template T The command tree, inferred from it.
 * @param commands The commands, keyed by root name.
 * @returns A function that removes this call's commands; it is safe to call twice.
 */
export function register<T>(commands: CommandTree<T>): () => void {
	return namespaceCommands.register(commands);
}

/**
 * @description Removes a root command added with `register`, with its subcommands. Does nothing when there is none.
 * @param name The root command's name.
 */
export function unregister(name: string): void {
	namespaceCommands.unregister(name);
}

export default { option, createCommands, register, unregister };
