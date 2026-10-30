import { createLogger } from '@unbound-app/logger';
import { Platform } from 'react-native';

import { getSetting, setSetting } from '~/lib/unbound-settings';
import { CLIENT_VERSION } from '~/lib/constants';
import ErrorFallback from '~/ui/error-boundary';
import { createPatcher } from '~/api/patcher';
import { findByName } from '~/api/metro';
import { reload } from '~/api/native';

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

function enterRecoveryMode() {
	setSetting('recovery', true);
	void reload();
}

/** Replaces Discord's crash screen with Unbound's fallback and logs what it caught, unless disabled in settings. */
export function start() {
	const enabled = getSetting('error-boundary.enabled');

	if (!enabled) return;

	const Boundary = findByName('ErrorBoundary');

	if (!Boundary) {
		Logger.error('Failed to find ErrorBoundary component');

		return;
	}

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
	Patcher.unpatchAll();
}

export default { start, stop };
