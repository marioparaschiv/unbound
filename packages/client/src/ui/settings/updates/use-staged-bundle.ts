import { hasStagedBundle } from '~/native/unbound-native';

/**
 * @description Reads whether the loader has staged a client bundle for the next launch. It asks the loader on
 * every render, since the loader stages bundles on its own, after the last check.
 * @returns Whether a bundle waits for a restart.
 */
function useStagedBundle(): boolean {
	// A hook call runs every render; the React Compiler would otherwise keep the first answer.
	'use no memo';

	return hasStagedBundle();
}

export default useStagedBundle;
