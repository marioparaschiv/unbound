import { createDraft, createLocalThemeId } from '~/themes/draft';
import { navigationReady } from '~/core/navigation-ready';
import ThemeEditorStore from '~/themes/editor-state';
import { parseThemeBundle } from '~/themes/bundle';
import { Screens } from '~/core/constants';
import { themes } from '~/themes/manager';
import { confirm } from '~/dialogs/api';
import ThemeStore from '~/themes/state';

import { currentBase } from './token-colors';
import { tokenGroup } from './token-groups';

type Navigation = { push: (screen: string) => void };

type EditorRoute = { name: string; params?: Record<string, string> };

// Rebuilds the stack beneath the screen, so going back walks through the editor rather than closing settings.
async function showEditor(routes: EditorRoute[]) {
	const ref = await navigationReady();

	ref.navigate('settings', { state: { routes, index: routes.length - 1 } });
}

function begin(id: string | undefined) {
	const addon = id ? themes.getAddon(id) : undefined;
	const draft = addon
		? parseThemeBundle(addon.bundle)
		: createDraft(ThemeStore.getState().data, currentBase());

	ThemeEditorStore.getState().begin(
		{
			// Fixed for the session, so saving twice overwrites one theme.
			id: addon?.id ?? createLocalThemeId(),
			name: addon?.name ?? '',
			description: addon?.manifest.description ?? '',
		},
		draft,
	);
}

/**
 * @description Opens the theme editor, resuming the open edit when it is of the same theme, and asking before it drops an
 * edit of another one.
 * @param navigation The settings stack to push the editor onto.
 * @param id The local theme to edit, or `undefined` to make a new theme from the applied one.
 */
export async function openThemeEditor(navigation: Navigation, id?: string): Promise<void> {
	const { session } = ThemeEditorStore.getState();
	// Create resumes a theme not saved yet; Edit resumes only its own theme.
	const resumes = session && (id ? session.id === id : !themes.getAddon(session.id));

	if (session && !resumes) {
		const confirmed = await confirm('UNBOUND_THEME_DISCARD', {
			body: 'UNBOUND_THEME_DISCARD_OTHER',
			confirm: 'UNBOUND_THEME_DISCARD',
			destructive: true,
		});

		if (!confirmed) return;
	}

	if (!resumes) {
		begin(id);
	}

	navigation.push(Screens.ThemeEditor);
}

/**
 * @description Returns to the open theme edit from anywhere in Discord, on the editor screen the user left.
 */
export async function resumeThemeEditor(): Promise<void> {
	const { route } = ThemeEditorStore.getState();
	const routes: EditorRoute[] = [{ name: Screens.ThemeEditor }];

	if (route?.screen === Screens.ThemeColors) {
		routes.push({ name: Screens.ThemeColors });

		if (route.params?.group) {
			routes.push({ name: Screens.ThemeColors, params: route.params });
		}
	}

	await showEditor(routes);
}

/**
 * @description Opens the open theme edit on one token: its All Colors group, with the token pinned first.
 * @param token The token's name.
 */
export async function openThemeColor(token: string): Promise<void> {
	await showEditor([
		{ name: Screens.ThemeEditor },
		{ name: Screens.ThemeColors },
		{ name: Screens.ThemeColors, params: { group: tokenGroup(token), token } },
	]);
}
