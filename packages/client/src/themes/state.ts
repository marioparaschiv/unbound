import type { Theme } from '@unbound-app/types';
import { create } from 'zustand';

import type { ChatBackground } from '~/themes/chat-background';

type ThemeStore = {
	applied: string | null;
	data: Theme | null;
	/** The chat background to draw, from the applied theme or the user's settings. */
	background: ChatBackground | null;
	setApplied: (id: string | null, theme: Theme | null) => void;
	setBackground: (background: ChatBackground | null) => void;
};

const ThemeStore = create<ThemeStore>((set) => ({
	applied: null,
	data: null,
	background: null,
	setApplied: (id, theme) => set({ applied: id, data: theme }),
	setBackground: (background) => set({ background }),
}));

export default ThemeStore;
