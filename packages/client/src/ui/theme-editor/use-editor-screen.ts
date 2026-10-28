import { useEffect } from 'react';

import ThemeEditorStore from '~/stores/theme-editor';
import { Discord } from '~/api/metro/components';

/**
 * @description Counts the calling screen as a focused theme editor screen, which hides the floating editor
 * button, until the screen blurs or unmounts.
 */
function useEditorScreen() {
	const navigation = Discord.useNavigation();

	useEffect(() => {
		const { focus, blur } = ThemeEditorStore.getState();
		// Blur and unmount can both follow one focus; the flag keeps the count from going negative.
		let counted = false;

		function enter() {
			if (counted) return;

			counted = true;
			focus();
		}

		function leave() {
			if (!counted) return;

			counted = false;
			blur();
		}

		if (navigation.isFocused()) {
			enter();
		}

		const offFocus = navigation.addListener('focus', enter);
		const offBlur = navigation.addListener('blur', leave);

		return () => {
			offFocus();
			offBlur();
			leave();
		};
	}, [navigation]);
}

export default useEditorScreen;
