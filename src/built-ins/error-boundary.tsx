import type { BuiltInData } from '@typings/built-ins';
import { ErrorBoundary } from '@ui/error-boundary';
import { createLogger } from '@structures/logger';
import { createPatcher } from '@patcher';
import { getStore } from '@api/storage';
import { findByName } from '@api/metro';


const Patcher = createPatcher('unbound::error-boundary');
const Logger = createLogger('Core', 'Error Boundary');
const Settings = getStore('unbound');

export const data: BuiltInData = {
	name: 'Error Boundary',
	shouldInitialize: () => Settings.get('error-boundary', true),
	settings: {
		monitor: [
			'error-boundary'
		],
	}
};

export function start() {
	const Boundary = findByName('ErrorBoundary');
	if (!Boundary) return Logger.error('Failed to find ErrorBoundary.');

	Patcher.after(Boundary.prototype, 'render', (self, _, res) => {
		if (!self.state.error) return res;

		return <ErrorBoundary
			error={self.state.error}
			retryRender={() => self.setState({ error: null, info: null })}
			res={res}
		/>;
	});
}

export function stop() {
	Patcher.unpatchAll();
}