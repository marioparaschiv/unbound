import type { Theme } from '@unbound-app/types';
import { create } from 'zustand';

type ThemeStore = {
	applied: string | null;
	data: Theme | null;
	setApplied: (id: string | null, theme: Theme | null) => void;
};

const ThemeStore = create<ThemeStore>((set) => ({
	applied: null,
	data: null,
	setApplied: (id, theme) => set({ applied: id, data: theme }),
}));

export default ThemeStore;
