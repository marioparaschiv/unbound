import type { BuiltInData } from '@typings/built-ins';
import { ErrorBoundary } from '@ui/error-boundary';
import { createPatcher } from '@patcher';
import { findByName } from '@api/metro';
import { getStore } from '@api/storage';

const Patcher = createPatcher('unbound::error-boundary');
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

export function initialize() {
	const Boundary = findByName('ErrorBoundary');
	if (!Boundary) return;

	Patcher.after(Boundary.prototype, 'render', (self, _, res) => {
		if (!self.state.error) return res;

		return <ErrorBoundary
			error={self.state.error}
			retryRender={() => self.setState({ error: null, info: null })}
			res={res}
		/>;
	});
}

export function shutdown() {
	Patcher.unpatchAll();
}