import { Platform } from 'react-native';

import ThemeEditorStore from '~/themes/editor-state';
import { Screens } from '~/metro/common';

import ColorPickOverlay from './color-pick-overlay';
import EditorButtons from './editor-buttons';

/**
 * @description Drawn while a theme edit is open and no editor screen is: the floating buttons, or the picker's overlay
 * while it waits for a tap. Nothing is drawn while the picker reads the screen, so it finds what is underneath.
 */
function ThemeEditorButton() {
	const picker = ThemeEditorStore((state) => state.picker);

	if (picker === 'reading') return null;

	const content = picker === 'picking' ? <ColorPickOverlay /> : <EditorButtons />;

	// iOS opens settings in a native sheet, which only a full-window overlay draws above; Android has neither.
	return Platform.OS === 'ios' ? (
		<Screens.FullWindowOverlay>{content}</Screens.FullWindowOverlay>
	) : (
		content
	);
}

export default ThemeEditorButton;
