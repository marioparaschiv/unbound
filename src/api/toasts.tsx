import { ToastOptions } from '@typings/api/toasts';
import { useSettingsStore } from '@api/storage';
import { addToast } from '@stores/toasts';
import { createPatcher } from '@patcher';
import { createLogger } from '@logger';
import { find } from '@metro';

import { ToastContainer } from '@ui/toasts';

const Patcher = createPatcher('toasts');
const Logger = createLogger('Toasts');

export function showToast(options: ToastOptions) {
	addToast(options);
}

try {
	const Container = find(m => m.type?.name === 'ToastContainer');

	Patcher.after(Container, 'type', (_, __, res) => {
		const settings = useSettingsStore('enmity');

		if (!settings.get('toasts.enabled', true)) {
			return res;
		}

		return <>
			{res}
			<ToastContainer />
		</>;
	});
} catch (e) {
	Logger.error('Failed to patch ToastContainer:', e.message);
}

export default { showToast };