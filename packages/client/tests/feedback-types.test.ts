import { describe, expect, test } from 'bun:test';

import type * as dialogs from '~/dialogs/api';
import type * as toasts from '~/toasts/api';

// Never called: `bun run typecheck` checks that core callers pass Unbound's own keys, with their generated vars.
function core(toast: typeof toasts, dialog: typeof dialogs, cause: unknown) {
	toast.success('UNBOUND_OK');
	toast.info('UNBOUND_INSTALL_FAILED', { name: 'Rule' });
	toast.error(cause);
	toast.error('UNBOUND_DELETE_TITLE', { name: 'Rule' }, cause);
	void dialog.confirm('UNBOUND_DELETE_TITLE', {
		titleVars: { name: 'Rule' },
		confirm: 'UNBOUND_DELETE',
		destructive: true,
	});

	// @ts-expect-error literal text is not a message key
	toast.success('Saved');
	// @ts-expect-error a key Unbound's en-US file does not have
	toast.warning('UNBOUND_NOT_A_KEY');
	// @ts-expect-error UNBOUND_INSTALL_FAILED needs `name`
	toast.info('UNBOUND_INSTALL_FAILED');
	// @ts-expect-error UNBOUND_OK has no placeholders
	toast.success('UNBOUND_OK', { name: 'Rule' });
	// @ts-expect-error literal text as a dialog title
	void dialog.alert('Heads up');

	// The low-level APIs stay open to text composed at runtime.
	toast.show({ title: 'Composed at runtime' });
	dialog.showDialog({ title: 'Composed at runtime', cancel: true });
}

describe('core feedback shorthand types', () => {
	test('are checked by the typecheck, not at runtime', () => {
		expect(typeof core).toBe('function');
	});
});
