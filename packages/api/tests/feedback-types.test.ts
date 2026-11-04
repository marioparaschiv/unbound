import { describe, expect, test } from 'bun:test';

import type * as dialogs from '../src/dialogs';
import type * as toasts from '../src/toasts';

// Never called: `bun run typecheck` checks these against the fixture's generated `@unbound-app/i18n`.
function plugin(toast: typeof toasts, dialog: typeof dialogs, cause: unknown, name: string) {
	toast.success('SAVED');
	toast.success('STARRED', { name });
	toast.info('SAVED_N', { count: 2 }, { duration: 5000 });
	toast.warning('SAVED', { icon: 'WarningIcon' });
	toast.error(cause);
	toast.error(new Error('Offline'));
	toast.error('SAVED', cause);
	toast.error('DELETE_TITLE', { name }, cause, { duration: 0 });

	// @ts-expect-error literal text is not a message key
	toast.success('Saved!');
	// @ts-expect-error a key the plugin's en-US file does not have
	toast.info('MISSING_KEY');
	// @ts-expect-error vars are required for a key with placeholders
	toast.success('STARRED');
	// @ts-expect-error vars are forbidden for a key without placeholders
	toast.success('SAVED', { name });
	// @ts-expect-error `count` is a number
	toast.success('SAVED_N', { count: 'two' });
	// @ts-expect-error `name` is not a placeholder of SAVED_N
	toast.success('SAVED_N', { name });
	// @ts-expect-error the vars come before the error
	toast.error('DELETE_TITLE', cause);
	// @ts-expect-error a title before the error is a message key
	toast.error('Could not save', cause);
	// @ts-expect-error `content` is not a shorthand option; use `show`
	toast.success('SAVED', { content: 'More' });

	void dialog.confirm('DELETE_TITLE', {
		titleVars: { name },
		body: 'DELETE_BODY',
		confirm: 'DELETE',
		destructive: true,
	});
	void dialog.confirm('SAVED', { body: 'STARRED', bodyVars: { name }, confirm: 'DELETE' });
	void dialog.alert('SAVED');
	void dialog.alert('SAVED', { body: 'DELETE_BODY' });
	void dialog.alert('DELETE_TITLE', { titleVars: { name } });

	// @ts-expect-error literal text is not a message key
	void dialog.confirm('Delete?', { confirm: 'DELETE' });
	// @ts-expect-error a title with placeholders needs `titleVars`
	void dialog.confirm('DELETE_TITLE', { confirm: 'DELETE' });
	// @ts-expect-error a title without placeholders forbids `titleVars`
	void dialog.confirm('SAVED', { titleVars: { name }, confirm: 'DELETE' });
	// @ts-expect-error a body with placeholders needs `bodyVars`
	void dialog.alert('SAVED', { body: 'STARRED' });
	// @ts-expect-error confirm needs its button's key
	void dialog.confirm('SAVED', {});
	// @ts-expect-error a title with placeholders needs its options
	void dialog.alert('DELETE_TITLE');
	// @ts-expect-error an unknown key as the body
	void dialog.alert('SAVED', { body: 'NOPE' });
}

describe('feedback shorthand types', () => {
	test('are checked by the typecheck, not at runtime', () => {
		expect(typeof plugin).toBe('function');
	});
});
