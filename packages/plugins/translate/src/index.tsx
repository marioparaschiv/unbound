import { toasts } from '@unbound-app/api';

import { startTranslateMenuPatch, stopTranslateMenuPatch } from '@translate/menu';
import { TranslateSettingsScreen } from '@translate/settings';

export default {
	start() {
		try {
			startTranslateMenuPatch();
		} catch (error) {
			toasts.showToast({
				title: 'Translate',
				content: error instanceof Error ? error.message : String(error),
			});
		}
	},

	stop() {
		try {
			stopTranslateMenuPatch();
		} catch {}
	},
	getSettingsPanel: () => <TranslateSettingsScreen />,
};
