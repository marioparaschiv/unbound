import { BuiltIn } from '@typings/core/builtins';
import { ErrorBoundary } from '@ui/components';
import { createPatcher } from '@patcher';
import { findByName } from '@metro';

const Patcher = createPatcher('error-boundary');

const Boundary = findByName('ErrorBoundary');

export const data: BuiltIn['data'] = {
	id: 'dev.errorBoundary',
	default: true
};

export function initialize() {
	if (!Boundary) return;

	Patcher.after(Boundary.prototype, 'render', (self, _, res) => {
		return <ErrorBoundary state={self.state}>
			{res}
		</ErrorBoundary>;
	});
}

export function shutdown() {
	Patcher.unpatchAll();
}