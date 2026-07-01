import type { SettingsEntry } from '@unbound-app/types';
import { create } from 'zustand';

interface SettingsStore {
	sections: Record<string, SettingsEntry>;
	registerSection: (entry: SettingsEntry) => void;
	removeSection: (key: string) => void;
}

const SettingsStore = create<SettingsStore>((set) => ({
	sections: {},
	registerSection: (entry) =>
		set((prev) => ({ sections: { ...prev.sections, [entry.key]: entry } })),
	removeSection: (key) =>
		set((prev) => {
			const sections = { ...prev.sections };
			delete sections[key];
			return { sections };
		}),
}));

export default SettingsStore;
