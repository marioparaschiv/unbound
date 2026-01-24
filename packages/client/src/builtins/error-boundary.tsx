import { createLogger } from '@unbound-app/logger';
import { createPatcher } from 'possess';

import { findByName } from '~/api/metro';
import storage from '~/api/storage';

const Patcher = createPatcher('ErrorBoundary');
const Logger = createLogger('ErrorBoundary');
const Settings = storage.getStore('unbound');

export function start() {
	const enabled = Settings.get('error-boundary.enabled', true);
	if (!enabled) return;

	const Boundary = findByName('ErrorBoundary');
	if (!Boundary) {
		Logger.error('Failed to find ErrorBoundary component');
		return;
	}

	Patcher.after(Boundary.prototype, 'render', ({ this: self, result }) => {
		if (!self.state?.error) return result;

		Logger.error('React Error Boundary caught error:', self.state.error);

		return result;
	});
}

export function stop() {
	Patcher.unpatchAll();
}

export default { start, stop };
