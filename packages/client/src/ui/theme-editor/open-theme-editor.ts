import type { Navigation } from '@unbound-app/types/components';

import type { ThemeEditorSession } from '~/stores/theme-editor';
import { createDraft, readDraft } from '~/lib/theme-draft';
import { createLocalThemeId } from '~/lib/local-themes';
import type { LocalThemeId } from '~/lib/local-themes';
import ThemeEditorStore from '~/stores/theme-editor';
import { Discord } from '~/api/metro/components';
import { themes } from '~/managers/themes';
import { Screens } from '~/lib/constants';
import { Messages } from '~/api/i18n';

import { currentAppearance } from './token-color';

function createSession(id: LocalThemeId | undefined): ThemeEditorSession {
	const entity = id ? themes.getEntity(id) : undefined;
	const bundle = entity ? readDraft(entity.bundle) : undefined;

	return {
		// The id is fixed for the session, so saving twice or retrying overwrites one theme.
		id: id ?? createLocalThemeId(),
		initial: bundle ?? createDraft(currentAppearance()),
		name: entity?.data.name ?? '',
		description: entity?.data.description ?? '',
	};
}

function isSameTheme(session: ThemeEditorSession, id: LocalThemeId | undefined) {
	// Create resumes a theme that has never been saved; Edit resumes only its own theme.
	return id ? session.id === id : !themes.getEntity(session.id);
}

/**
 * @description Opens the theme editor on a theme, resuming the open session when it edits the same theme
 * and asking before it discards a session on another theme.
 * @param navigation The settings navigation to push the editor onto.
 * @param id The local theme to edit, or `undefined` to create a theme.
 */
export function openThemeEditor(navigation: Navigation, id?: LocalThemeId): void {
	const { session } = ThemeEditorStore.getState();

	function open() {
		navigation.push(Screens.ThemeEditor, {});
	}

	function restart() {
		const store = ThemeEditorStore.getState();

		store.end();
		store.begin(createSession(id));
		open();
	}

	if (!session) {
		restart();

		return;
	}

	if (isSameTheme(session, id)) {
		open();

		return;
	}

	Discord.showConfirmModal({
		title: Messages.UNBOUND_THEME_DISCARD,
		content: Messages.UNBOUND_THEME_DISCARD_OTHER,
		confirmText: Messages.UNBOUND_THEME_DISCARD,
		cancelText: Messages.UNBOUND_CANCEL,
		onConfirm: restart,
	});
}

export default { openThemeEditor };
