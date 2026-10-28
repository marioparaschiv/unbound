import type { Theme } from '@unbound-app/types';
import { create } from 'zustand';

import type { LocalThemeId } from '~/lib/local-themes';
import ThemeStore from '~/stores/themes';

/** An open theme editor session: what it opened with, plus the details typed so far. */
export type ThemeEditorSession = {
	id: LocalThemeId;
	/** The bundle the editor opened with; the live draft is `ThemeStore.preview`. */
	initial: Theme;
	name: string;
	description: string;
};

type ThemeEditorDetails = Pick<ThemeEditorSession, 'name' | 'description'>;

type ThemeEditorStore = {
	session: ThemeEditorSession | null;
	/** How many editor screens are focused; the floating button shows only at zero. */
	focused: number;
	begin: (session: ThemeEditorSession) => void;
	setDetails: (details: Partial<ThemeEditorDetails>) => void;
	end(): void;
	focus: () => void;
	blur: () => void;
};

const ThemeEditorStore = create<ThemeEditorStore>((set, get) => ({
	session: null,
	focused: 0,
	begin(session) {
		set({ session });
		ThemeStore.getState().setPreview(session.initial);
	},
	setDetails(details) {
		const { session } = get();

		if (!session) return;

		set({ session: { ...session, ...details } });
	},
	end() {
		if (!get().session) return;

		set({ session: null });
		ThemeStore.getState().setPreview(null);
	},
	focus: () => set((prev) => ({ focused: prev.focused + 1 })),
	blur: () => set((prev) => ({ focused: Math.max(0, prev.focused - 1) })),
}));

export default ThemeEditorStore;
