import { useEffect } from 'react';

import { createPatcher } from '~/patcher/create-patcher';

import { ThemeUtils } from './appearance-picker';

const Patcher = createPatcher('unbound::design-picker');

/**
 * @description While mounted, Discord's theme picker never saves one of this picker's swatches as Discord's theme.
 * The page applies the swatch the carousel settles on, and the one in view when it closes; the picker's own save
 * on close can read another picker's pending index, so it is dropped. Other swatches save as usual.
 * @param ids The ids of this picker's swatches.
 */
function useSaveIntercept(ids: string[]) {
	useEffect(() => {
		const own = new Set(ids);

		return Patcher.instead(ThemeUtils, 'handleSaveTheme', ({ args, original, this: self }) => {
			if (own.has(args[0]?.unboundAddonId ?? '')) return;

			// Another picker's swatches pass on to its own patch; Discord's own save as usual.
			return original.apply(self, args);
		});
	}, [ids]);
}

export default useSaveIntercept;
