import ThemeEditorStore from '~/themes/editor-state';
import { Discord } from '~/metro/components';
import { messages } from '~/i18n/api';
import { icons } from '~/assets/api';

import useStyles from './editor-actions.style';

type EditorActionsProps = {
	saving: boolean;
	onSave: () => void;
};

/**
 * @description The theme editor's header actions, as Discord's nav-bar buttons: Undo and Redo, then Save, which needs a name.
 */
function EditorActions({ saving, onSave }: EditorActionsProps) {
	const styles = useStyles();
	const canUndo = ThemeEditorStore((state) => state.past.length > 0);
	const canRedo = ThemeEditorStore((state) => state.future.length > 0);
	const named = ThemeEditorStore((state) => Boolean(state.session?.name.trim()));

	return (
		<Discord.Stack direction='horizontal' spacing={16} align='center' style={styles.actions}>
			<Discord.HeaderActionButton
				source={icons['UndoIcon']}
				disabled={!canUndo}
				accessibilityLabel={messages.UNBOUND_UNDO}
				onPress={() => ThemeEditorStore.getState().undo()}
			/>
			<Discord.HeaderActionButton
				source={icons['RedoIcon']}
				disabled={!canRedo}
				accessibilityLabel={messages.UNBOUND_REDO}
				onPress={() => ThemeEditorStore.getState().redo()}
			/>
			{saving ? (
				<Discord.HeaderSubmittingIndicator />
			) : (
				<Discord.HeaderActionButton
					text={messages.UNBOUND_SAVE}
					disabled={!named}
					onPress={onSave}
				/>
			)}
		</Discord.Stack>
	);
}

export default EditorActions;
