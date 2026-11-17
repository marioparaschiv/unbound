import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { useRef } from 'react';

import { Discord, SafeArea } from '~/metro/components';
import ThemeEditorStore from '~/themes/editor-state';
import { messages } from '~/i18n/api';

import useStyles from './color-pick-overlay.style';
import { pickColorAt } from './pick-color';

/**
 * @description Covers the screen while the colour picker waits for a tap, so the tap presses nothing underneath. A hint
 * at the top explains and cancels.
 */
function ColorPickOverlay() {
	const styles = useStyles();
	const ref = useRef<View>(null);

	function pick({ nativeEvent }: GestureResponderEvent) {
		if (ref.current) {
			void pickColorAt(ref.current, nativeEvent.pageX, nativeEvent.pageY);
		}
	}

	return (
		<Pressable
			ref={ref}
			style={StyleSheet.absoluteFill}
			accessibilityLabel={messages.UNBOUND_THEME_PICK_HINT}
			onPress={pick}
		>
			<SafeArea.SafeAreaPaddingView top pointerEvents='box-none'>
				<View style={styles.hint}>
					<Discord.Text style={styles.text} variant='text-sm/semibold'>
						{messages.UNBOUND_THEME_PICK_HINT}
					</Discord.Text>
					<Discord.Button
						size='sm'
						variant='secondary'
						text={messages.UNBOUND_CANCEL}
						onPress={() => ThemeEditorStore.getState().setPicker('idle')}
					/>
				</View>
			</SafeArea.SafeAreaPaddingView>
		</Pressable>
	);
}

export default ColorPickOverlay;
