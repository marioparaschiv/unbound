import { ToastOptions } from '@typings/api/toasts';
import { useSettingsStore } from '@api/storage';
import { addToast } from '@stores/toasts';
import { createPatcher } from '@patcher';
import { createLogger } from '@logger';
import { findByProps } from '@metro';

import { ToastContainer } from '@ui/toasts';

const Patcher = createPatcher('toasts');
const Logger = createLogger('Toasts');

export function showToast(options: ToastOptions) {
	return addToast(options);
}

try {
	const { ToastContainer: Container } = findByProps('ToastContainer', { lazy: true });

	Patcher.after(Container, 'type', (_, __, res) => {
		const settings = useSettingsStore('unbound');

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