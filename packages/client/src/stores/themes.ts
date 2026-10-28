import type { Theme } from '@unbound-app/types';
import { create } from 'zustand';

type ThemeStore = {
	applied: string | null;
	data: Theme | null;
	/** The theme editor's unsaved draft, drawn over `data` while the editor is open. */
	preview: Theme | null;
	setApplied: (id: string | null, theme: Theme | null) => void;
	setPreview: (theme: Theme | null) => void;
	updatePreview(update: (draft: Theme) => Theme): void;
};

const ThemeStore = create<ThemeStore>((set, get) => ({
	applied: null,
	data: null,
	preview: null,
	setApplied: (id, theme) => set({ applied: id, data: theme }),
	setPreview: (theme) => set({ preview: theme }),
	updatePreview(update) {
		const { preview } = get();

		if (!preview) return;

		const next = update(preview);

		if (next !== preview) {
			set({ preview: next });
		}
	},
}));

export default ThemeStore;
