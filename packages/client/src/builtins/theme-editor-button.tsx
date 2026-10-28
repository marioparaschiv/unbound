import { createLogger } from '@unbound-app/logger';
import { cloneElement } from 'react';

import { findRootThemeProvider, mapThemeProvider } from '~/lib/root-theme-provider';
import type { RootThemeElement } from '~/lib/root-theme-provider';
import { ThemeEditorButton } from '~/ui/theme-editor';
import { createPatcher } from '~/api/patcher';

const Patcher = createPatcher('unbound::theme-editor-button');
const Logger = createLogger('ThemeEditorButton');

/** Mounts the floating theme editor button inside Discord's root theme provider, so it exists on every screen. */
export function start() {
	const root = findRootThemeProvider();

	if (!root) {
		Logger.error('Failed to find the root theme provider.');

		return;
	}

	Patcher.after(root, 'RootThemeContextProvider', ({ result }) => {
		const element: RootThemeElement = result;

		return mapThemeProvider(element, (provider) =>
			cloneElement(provider, {
				children: (
					<>
						{provider.props.children}
						<ThemeEditorButton />
					</>
				),
			}),
		);
	});
}

/** Removes the floating theme editor button. */
export function stop() {
	Patcher.unpatchAll();
}

export default { start, stop };
