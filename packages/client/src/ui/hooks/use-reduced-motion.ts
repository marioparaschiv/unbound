import { Accessibility } from '~/metro/stores';
import { FluxHooks } from '~/metro/common';

/**
 * @description Reads Discord's reduced-motion preference, re-rendering when it changes.
 * @returns Whether the user asked Discord for reduced motion.
 */
function useReducedMotion(): boolean {
	return FluxHooks.useStateFromStores([Accessibility], () =>
		Boolean(Accessibility.useReducedMotion),
	);
}

export default useReducedMotion;
