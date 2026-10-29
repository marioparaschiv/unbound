import { createLogger } from '@unbound-app/logger';
import { Platform } from 'react-native';

import { filters, onModuleLoaded } from '~/api/metro';
import { CLIENT_VERSION } from '~/lib/constants';
import ErrorFallback from '~/ui/error-boundary';
import { createPatcher } from '~/api/patcher';
import { reload } from '~/api/native';
import storage from '~/api/storage';

type BoundaryState = {
	error?: Error | null;
};

type ClearedState = {
	error: null;
};

type BoundaryInstance = {
	state?: BoundaryState;
	setState: (state: ClearedState) => void;
	__unboundComponentStack?: string;
};

const Patcher = createPatcher('ErrorBoundary');
const Logger = createLogger('ErrorBoundary');
const Settings = storage.getStore('unbound');

let stopWaiting: (() => void) | null = null;

function enterRecoveryMode() {
	Settings.set('recovery', true);
	void reload();
}

/** Replaces Discord's crash screen with Unbound's fallback and logs what it caught, unless disabled in settings. */
export function start() {
	const enabled = Settings.get('error-boundary.enabled', true);

	if (!enabled) return;

	stopWaiting = onModuleLoaded(filters.byName('ErrorBoundary'), patchBoundary);
}

function patchBoundary(Boundary: MetroExport) {
	Patcher.after(
		Boundary.prototype,
		'componentDidCatch',
		({ this: self, args: [error, info] }) => {
			const boundary: BoundaryInstance = self;

			boundary.__unboundComponentStack = info?.componentStack;
			Logger.error('React Error Boundary caught error:', error);
		},
	);

	Patcher.after(Boundary.prototype, 'render', ({ this: self, result }) => {
		const boundary: BoundaryInstance = self;
		const error = boundary.state?.error;

		if (!error) {
			return result;
		}

		return (
			<ErrorFallback
				error={error}
				componentStack={boundary.__unboundComponentStack}
				clientVersion={CLIENT_VERSION}
				platform={Platform.OS}
				onRetry={() => {
					boundary.__unboundComponentStack = undefined;
					boundary.setState({ error: null });
				}}
				onReload={() => void reload()}
				onRecovery={enterRecoveryMode}
			/>
		);
	});
}

/** Removes the error boundary patch. */
export function stop() {
	stopWaiting?.();
	stopWaiting = null;
	Patcher.unpatchAll();
}

export default { start, stop };
