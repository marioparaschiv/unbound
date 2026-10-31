import { Accessibility } from '~/metro/stores';
import { useStore } from '~/flux/api';

/**
 * @description Reads Discord's reduced-motion preference, re-rendering when it changes.
 * @returns Whether the user asked Discord for reduced motion.
 */
function useReducedMotion(): boolean {
	return useStore(Accessibility, () => Boolean(Accessibility.useReducedMotion));
}

export default useReducedMotion;
