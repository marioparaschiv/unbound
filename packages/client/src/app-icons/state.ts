import type { UnboundAppIcon } from '@unbound-app/types';
import { create } from 'zustand';

import { getAppIcons } from '~/native/unbound-native';

type AppIconStoreState = {
	icons: UnboundAppIcon[];
	/** The native id Discord last applied this launch; native reads can lag behind it. */
	current: string | undefined;
	refresh(): UnboundAppIcon[];
	setCurrent(id: string): void;
};

const AppIconStore = create<AppIconStoreState>((set) => ({
	icons: [],
	current: undefined,

	refresh() {
		const icons = getAppIcons();

		set({ icons });

		return icons;
	},

	setCurrent(id) {
		set({ current: id });
	},
}));

export default AppIconStore;
