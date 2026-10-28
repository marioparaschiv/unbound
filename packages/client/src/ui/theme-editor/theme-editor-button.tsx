import { SafeAreaView, View } from 'react-native';

import ThemeEditorStore from '~/stores/theme-editor';
import { RootNavigation, Screens as NativeScreens } from '~/api/metro/common';
import { Discord } from '~/api/metro/components';
import { Screens } from '~/lib/constants';
import { Messages } from '~/api/i18n';
import { Icons } from '~/api/assets';

import useStyles, { BOTTOM_OFFSET } from './theme-editor-button.style';

function resume() {
	RootNavigation.getRootNavigationRef().navigate('settings', {
		screen: Screens.ThemeEditor,
		params: {},
	});
}

/**
 * @description A floating button, shown anywhere outside the editor while a theme is being edited, that
 * returns to the theme editor.
 */
function ThemeEditorButton() {
	const styles = useStyles();
	const visible = ThemeEditorStore((state) => state.session !== null && state.focused === 0);

	if (!visible) return null;

	// The toast container has no size of its own and settings open in a native sheet above it, so the
	// button gets its own full-window layer, as toasts do.
	return (
		<NativeScreens.FullWindowOverlay>
			<SafeAreaView style={styles.container} pointerEvents='box-none'>
				<View style={styles.safeArea} pointerEvents='box-none'>
					<Discord.FloatingActionButton
						icon={Icons['PaintbrushThinIcon'] ?? 0}
						positionBottom={BOTTOM_OFFSET}
						accessibilityLabel={Messages.UNBOUND_THEME_EDITOR_RESUME}
						onPress={resume}
					/>
				</View>
			</SafeAreaView>
		</NativeScreens.FullWindowOverlay>
	);
}

export default ThemeEditorButton;
