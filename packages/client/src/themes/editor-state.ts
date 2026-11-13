import type { Theme } from '@unbound-app/types';
import { create } from 'zustand';

import ThemeStore from '~/themes/state';

/** How many draft changes Undo can walk back. */
const HISTORY_LIMIT = 50;

/** An open theme editor session: the theme it saves to and the details typed so far. The draft is `ThemeStore.preview`. */
export type ThemeEditorSession = {
	id: string;
	name: string;
	description: string;
};

/** The editor screen last shown, which the floating button returns to. */
export type ThemeEditorRoute = {
	screen: string;
	params?: Record<string, string>;
};

type ThemeEditorStore = {
	session: ThemeEditorSession | null;
	past: Theme[];
	future: Theme[];
	route: ThemeEditorRoute | null;
	/** Each editor screen's scroll offset, by screen key, so returning opens where the user left off. */
	offsets: Record<string, number>;
	/** How many editor screens are mounted; the floating button shows only at zero. */
	mounted: number;
	begin: (session: ThemeEditorSession, draft: Theme) => void;
	end: () => void;
	setDetails: (details: Partial<Omit<ThemeEditorSession, 'id'>>) => void;
	edit(draft: Theme): void;
	undo(): void;
	redo(): void;
	visit: (route: ThemeEditorRoute) => void;
	setOffset: (key: string, offset: number) => void;
	mount: () => void;
	unmount: () => void;
};

const ThemeEditorStore = create<ThemeEditorStore>((set, get) => ({
	session: null,
	past: [],
	future: [],
	route: null,
	offsets: {},
	mounted: 0,
	begin(session, draft) {
		set({ session, past: [], future: [], route: null, offsets: {} });
		ThemeStore.getState().setPreview(draft);
	},
	end() {
		set({ session: null, past: [], future: [], route: null, offsets: {} });
		ThemeStore.getState().setPreview(null);
	},
	setDetails: (details) =>
		set((prev) => (prev.session ? { session: { ...prev.session, ...details } } : {})),
	edit(draft) {
		const current = ThemeStore.getState().preview;

		if (!get().session || !current || draft === current) return;

		set((prev) => ({ past: [...prev.past, current].slice(-HISTORY_LIMIT), future: [] }));
		ThemeStore.getState().setPreview(draft);
	},
	undo() {
		const { past, future } = get();
		const current = ThemeStore.getState().preview;
		const previous = past.at(-1);

		if (!current || !previous) return;

		set({ past: past.slice(0, -1), future: [current, ...future] });
		ThemeStore.getState().setPreview(previous);
	},
	redo() {
		const { past, future } = get();
		const current = ThemeStore.getState().preview;
		const [next, ...rest] = future;

		if (!current || !next) return;

		set({ past: [...past, current], future: rest });
		ThemeStore.getState().setPreview(next);
	},
	visit: (route) => set({ route }),
	setOffset: (key, offset) => set((prev) => ({ offsets: { ...prev.offsets, [key]: offset } })),
	mount: () => set((prev) => ({ mounted: prev.mounted + 1 })),
	unmount: () => set((prev) => ({ mounted: Math.max(0, prev.mounted - 1) })),
}));

export default ThemeEditorStore;
