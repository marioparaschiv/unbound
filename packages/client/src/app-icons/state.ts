import type { UnboundAppIcon } from '@unbound-app/types';
import { create } from 'zustand';

import { getAppIcons } from '~/native/unbound-native';

type AppIconStoreState = {
	icons: UnboundAppIcon[];
	refresh(): UnboundAppIcon[];
};

const AppIconStore = create<AppIconStoreState>((set) => ({
	icons: [],

	refresh() {
		const icons = getAppIcons();

		set({ icons });

		return icons;
	},
}));

export default AppIconStore;
