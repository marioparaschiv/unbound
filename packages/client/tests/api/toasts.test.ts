import type { InternalToastOptions, ToastOptions } from '@unbound-app/types/toasts';
import { describe, expect, test, beforeEach } from 'bun:test';

import { showToast } from '~/api/toasts';
import ToastStore from '~/stores/toasts';

import { resetStore } from '../helpers/store-fixture';

const resetToasts = resetStore(ToastStore);

/** The single id present in the store, for assertions on generated ids. */
function onlyStoredId(): string {
	const ids = Object.keys(ToastStore.getState().toasts);
	expect(ids).toHaveLength(1);

	return ids[0];
}

beforeEach(() => {
	resetToasts();
});

describe('showToast', () => {
	test('a supplied id keys the toast verbatim', () => {
		showToast({ id: 'custom-id', content: 'hello' });

		expect(Object.keys(ToastStore.getState().toasts)).toEqual(['custom-id']);
	});

	test('a supplied id is preserved even when it is not id-shaped', () => {
		showToast({ id: 'a', content: 'short' });

		expect(ToastStore.getState().toasts['a'].id).toBe('a');
	});

	test('an absent id is filled with a 30 character generated id', () => {
		showToast({ content: 'generated' });

		const id = onlyStoredId();
		expect(id).toHaveLength(30);
		expect(ToastStore.getState().toasts[id].id).toBe(id);
	});

	test('two toasts without ids get distinct ids and coexist', () => {
		showToast({ content: 'first' });
		showToast({ content: 'second' });

		const ids = Object.keys(ToastStore.getState().toasts);
		expect(ids).toHaveLength(2);
		expect(ids[0]).not.toBe(ids[1]);
	});

	test('passthrough fields land in the store unchanged', () => {
		const onPress = () => {};
		const onTimeout = () => {};
		const options: ToastOptions = {
			id: 'rich',
			title: 'Update available',
			content: 'A new version is ready.',
			duration: 5000,
			icon: 42,
			tintedIcon: true,
			buttons: [{ content: 'Reload', variant: 'primary', onPress }],
			onTimeout,
		};

		showToast(options);

		const stored = ToastStore.getState().toasts['rich'];
		expect(stored).toMatchObject(options);
		expect(stored.date).toEqual(expect.any(Number));
		expect(Object.keys(stored).sort()).toEqual([...Object.keys(options), 'date'].sort());
	});

	test('FINDING: a caller-supplied date survives but is not accepted by ToastOptions', () => {
		// `date` lives only on `InternalToastOptions`, so `showToast`'s public `ToastOptions`
		// parameter rejects it at the type level while the store honours it at runtime. Correct
		// behaviour would be to widen the parameter to admit `date`, or to strip it so the public
		// contract and the runtime agree.
		const dated: InternalToastOptions = { id: 'dated', content: 'old', date: 1234 };

		showToast(dated);

		expect(ToastStore.getState().toasts['dated'].date).toBe(1234);
	});

	test('an absent date is stamped with the current time', () => {
		const before = Date.now();
		showToast({ id: 'undated', content: 'fresh' });
		const after = Date.now();

		const { date } = ToastStore.getState().toasts['undated'];
		expect(date).toBeGreaterThanOrEqual(before);
		expect(date).toBeLessThanOrEqual(after);
	});

	test('the returned handle updates the toast it created', () => {
		const seeded: InternalToastOptions = {
			id: 'handled',
			content: 'before',
			title: 'kept',
			date: 9,
		};
		const handle = showToast(seeded);

		handle.update({ content: 'after' });

		expect(ToastStore.getState().toasts['handled']).toEqual({
			id: 'handled',
			title: 'kept',
			content: 'after',
			date: 9,
		});
	});

	test('the returned handle closes the toast it created', () => {
		const handle = showToast({ id: 'closable', content: 'bye' });

		handle.close();

		expect(ToastStore.getState().toasts['closable'].closing).toBe(true);
	});

	test('a handle over a generated id targets that generated toast', () => {
		const handle = showToast({ content: 'generated' });
		const id = onlyStoredId();

		handle.update({ content: 'retargeted' });

		expect(ToastStore.getState().toasts[id].content).toBe('retargeted');
	});

	test('each handle drives only its own toast', () => {
		const first = showToast({ id: 'one', content: 'one' });
		showToast({ id: 'two', content: 'two' });

		first.close();

		expect(ToastStore.getState().toasts['one'].closing).toBe(true);
		expect(ToastStore.getState().toasts['two'].closing).toBeUndefined();
	});

	test('FINDING: showing over a live id replaces the toast and orphans its handle', () => {
		const first = showToast({ id: 'shared', content: 'first', title: 'original' });
		showToast({ id: 'shared', content: 'second' });

		first.update({ duration: 100 });

		// `showToast` forwards to `addToast`, which overwrites the entry wholesale, so the second
		// call drops `title` and the first handle silently drives the replacement. Correct behaviour
		// would be to either merge into the existing toast or reject a duplicate id, so a handle
		// never controls a toast its caller did not create.
		const stored = ToastStore.getState().toasts['shared'];
		expect(stored.title).toBeUndefined();
		expect(stored.content).toBe('second');
		expect(stored.duration).toBe(100);
	});

	test('MUTATION PROBE: the caller options object is mutated with the resolved date', () => {
		const options: ToastOptions = { id: 'aliased', content: 'body' };

		showToast(options);

		// `showToast` spreads into a fresh object, but `addToast` then stamps `date` onto that spread
		// object and stores it by reference, so the stored toast aliases nothing the caller holds.
		// The caller's own object stays clean, which is the behaviour this pins.
		expect(options).toEqual({ id: 'aliased', content: 'body' });
		expect(ToastStore.getState().toasts['aliased']).not.toBe(options);
	});
});
