import { AppState } from 'react-native';

import type { ForegroundSubscription } from '~/flat-recovery';

export const onAppForeground: ForegroundSubscription = (listener) => {
	const subscription = AppState.addEventListener('change', (state) => {
		if (state === 'active') listener();
	});

	return () => subscription.remove();
};

export default { onAppForeground };
