import { StyleSheet, View } from 'react-native';

import { Discord, SafeArea } from '~/metro/components';
import ThemeEditorStore from '~/themes/editor-state';
import { messages } from '~/i18n/api';
import { icons } from '~/assets/api';

import useStyles, { BUTTON_OFFSET, PICK_BUTTON_OFFSET } from './editor-buttons.style';
import { resumeThemeEditor } from './open-theme-editor';

/**
 * @description The floating buttons of an open theme edit: the eyedropper starts the colour picker, and the paintbrush
 * returns to the editor screen the user left.
 */
function EditorButtons() {
	const styles = useStyles();

	return (
		<SafeArea.SafeAreaPaddingView
			bottom
			style={StyleSheet.absoluteFill}
			pointerEvents='box-none'
		>
			<View style={styles.anchor} pointerEvents='box-none'>
				<Discord.FloatingActionButton
					icon={icons['EyeDropperIcon'] ?? 0}
					positionBottom={PICK_BUTTON_OFFSET}
					accessibilityLabel={messages.UNBOUND_THEME_PICK_COLOR}
					onPress={() => ThemeEditorStore.getState().setPicker('picking')}
				/>
				<Discord.FloatingActionButton
					icon={icons['PaintbrushThinIcon'] ?? 0}
					positionBottom={BUTTON_OFFSET}
					accessibilityLabel={messages.UNBOUND_THEME_EDITOR_RESUME}
					onPress={() => void resumeThemeEditor()}
				/>
			</View>
		</SafeArea.SafeAreaPaddingView>
	);
}

export default EditorButtons;
