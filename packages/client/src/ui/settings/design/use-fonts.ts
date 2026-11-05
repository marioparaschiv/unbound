import { useEffect, useReducer } from 'react';

import { Manager } from '~/addons/manager';

/**
 * @description Re-renders whenever the font store changes: installs, removals, overrides or presets.
 * @returns The Fonts manager.
 */
function useFonts() {
	const fonts = Manager.for('font');
	const [, rerender] = useReducer((count: number) => count + 1, 0);

	useEffect(() => {
		function handler() {
			rerender();
		}

		fonts.on('changed', handler);

		return () => void fonts.off('changed', handler);
	}, []);

	return fonts;
}

export default useFonts;
