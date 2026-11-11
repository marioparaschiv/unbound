import { useEffect } from 'react';

import { createPatcher } from '~/patcher/create-patcher';

import { ThemeUtils } from './appearance-picker';

const Patcher = createPatcher('unbound::design-picker');

let intercepting = false;

/**
 * Kept once installed: the picker saves its swatch from an async close handler that can finish after the page has
 * unmounted, and only Unbound's swatches carry an id, so Discord's own picker saves as usual.
 */
function intercept() {
	if (intercepting) return;

	intercepting = true;
	Patcher.instead(ThemeUtils, 'handleSaveTheme', ({ args, original, this: self }) => {
		if (args[0]?.unboundAddonId) return;

		return original.apply(self, args);
	});
}

/**
 * @description Stops Discord's theme picker from saving an Unbound swatch as Discord's theme, which would replace the
 * user's base theme and gradient. The page applies the swatch the carousel settles on, and the one in view when it closes.
 */
function useSaveIntercept() {
	useEffect(intercept, []);
}

export default useSaveIntercept;
