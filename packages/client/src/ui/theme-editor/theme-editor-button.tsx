import { Platform, StyleSheet, View } from 'react-native';

import { Discord, SafeArea } from '~/metro/components';
import { Screens } from '~/metro/common';
import { messages } from '~/i18n/api';
import { icons } from '~/assets/api';

import { resumeThemeEditor } from './open-theme-editor';
import useStyles, { BUTTON_OFFSET } from './theme-editor-button.style';

/**
 * @description The floating button shown while a theme edit is open and no editor screen is: it reopens settings on the
 * editor screen the user left, at the same scroll offset.
 */
function ThemeEditorButton() {
	const styles = useStyles();

	const button = (
		<SafeArea.SafeAreaPaddingView
			bottom
			style={StyleSheet.absoluteFill}
			pointerEvents='box-none'
		>
			<View style={styles.anchor} pointerEvents='box-none'>
				<Discord.FloatingActionButton
					icon={icons['PaintbrushThinIcon'] ?? 0}
					positionBottom={BUTTON_OFFSET}
					accessibilityLabel={messages.UNBOUND_THEME_EDITOR_RESUME}
					onPress={() => void resumeThemeEditor()}
				/>
			</View>
		</SafeArea.SafeAreaPaddingView>
	);

	// iOS opens settings in a native sheet, which only a full-window overlay draws above; Android has neither.
	return Platform.OS === 'ios' ? (
		<Screens.FullWindowOverlay>{button}</Screens.FullWindowOverlay>
	) : (
		button
	);
}

export default ThemeEditorButton;
