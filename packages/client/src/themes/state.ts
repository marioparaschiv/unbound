import type { Theme } from '@unbound-app/types';
import { create } from 'zustand';

import type { ChatBackground } from '~/themes/chat-background';

type ThemeStore = {
	applied: string | null;
	data: Theme | null;
	/** The theme editor's draft, drawn over the applied theme while an edit is open. */
	preview: Theme | null;
	/** Counts draft changes, so each one gets its own style cache. */
	revision: number;
	/** The chat background to draw, from the applied theme or the user's settings. */
	background: ChatBackground | null;
	setApplied: (id: string | null, theme: Theme | null) => void;
	setPreview: (theme: Theme | null) => void;
	setBackground: (background: ChatBackground | null) => void;
};

const ThemeStore = create<ThemeStore>((set) => ({
	applied: null,
	data: null,
	preview: null,
	revision: 0,
	background: null,
	setApplied: (id, theme) => set({ applied: id, data: theme }),
	setPreview: (theme) => set((prev) => ({ preview: theme, revision: prev.revision + 1 })),
	setBackground: (background) => set({ background }),
}));

/**
 * @description Reads the theme Discord should draw: the editor's draft while one is open, else the applied theme.
 * @returns The shown theme, or `null` for Discord's own.
 */
export function getShownTheme(): Theme | null {
	const { preview, data } = ThemeStore.getState();

	return preview ?? data;
}

export default ThemeStore;
