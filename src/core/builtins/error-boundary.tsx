import type { BuiltIn } from '@typings/core/builtins';
import { ErrorBoundary } from '@ui/error-boundary';
import { createPatcher } from '@patcher';
import { findByName } from '@api/metro';

const Patcher = createPatcher('error-boundary');

export const data: BuiltIn['data'] = {
	id: 'dev.errorBoundary',
	default: true
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