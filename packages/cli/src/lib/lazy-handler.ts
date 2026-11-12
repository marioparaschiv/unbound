import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import type { TObject } from '~/lib/schema';

/** What runs a command, typed by its definition's schema. */
export type CommandHandler<S extends TObject> = CommandDefinition<S>['handler'];

/** A module whose default export is a command's handler. */
export type HandlerModule<S extends TObject> = { default: CommandHandler<S> };

/**
 * @description Wraps a command's handler module so it loads only when the command runs: the menus,
 * `--help` and `ubd catalog` read a definition without importing what its handler needs.
 * @template S The command's schema.
 * @param load Imports the module whose default export is the handler.
 * @returns A handler that imports the module on its first call.
 */
export function lazyHandler<S extends TObject>(
	load: () => Promise<HandlerModule<S>>,
): CommandHandler<S> {
	return async (input, context) => (await load()).default(input, context);
}

export default lazyHandler;
