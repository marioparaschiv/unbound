import type { SettingsEntry } from '@unbound-app/types';
import { create } from 'zustand';

type SectionStore = {
	sections: Record<string, SettingsEntry>;
	registerSection: (entry: SettingsEntry) => void;
	removeSection: (key: string) => void;
};

const SectionStore = create<SectionStore>((set) => ({
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

export default SectionStore;
