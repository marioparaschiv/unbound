import { builtins } from '~/builtins/registry';

export type { BuiltIn } from '~/builtins/registry';

/** Starts a built-in feature under a name, skipping a name already registered. */
export const register = builtins.register.bind(builtins);
/** Stops the built-in feature registered under a name. */
export const unregister = builtins.unregister.bind(builtins);
