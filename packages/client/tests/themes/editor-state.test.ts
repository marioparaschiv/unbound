import { afterEach, describe, expect, test } from 'bun:test';
import type { Theme } from '@unbound-app/types';

import ThemeEditorStore from '~/themes/editor-state';
import ThemeStore from '~/themes/state';

const SESSION = { id: 'local.test', name: 'Test', description: '' };

function draft(value: string): Theme {
	return { type: 'darker', raw: {}, semantic: { TEXT_DEFAULT: { type: 'color', value } } };
}

function preview() {
	return ThemeStore.getState().preview?.semantic.TEXT_DEFAULT?.value;
}

afterEach(() => {
	ThemeEditorStore.getState().end();
	ThemeStore.getState().setApplied(null, null);
});

describe('a session', () => {
	test('beginning shows the draft and clears the last session', () => {
		const store = ThemeEditorStore.getState();

		store.begin(SESSION, draft('#000001'));
		store.visit({ screen: 'colors', params: { group: 'text' } });
		store.setOffset('text', 120);
		store.begin(SESSION, draft('#000002'));

		expect(preview()).toBe('#000002');
		expect(ThemeEditorStore.getState()).toMatchObject({ route: null, offsets: {}, past: [] });
	});

	test('ending drops the draft and its history', () => {
		const store = ThemeEditorStore.getState();

		store.begin(SESSION, draft('#000001'));
		store.edit(draft('#000002'));
		store.end();

		expect(ThemeStore.getState().preview).toBeNull();
		expect(ThemeEditorStore.getState()).toMatchObject({ session: null, past: [], future: [] });
	});

	test('details change only while a session is open', () => {
		ThemeEditorStore.getState().setDetails({ name: 'Ignored' });
		expect(ThemeEditorStore.getState().session).toBeNull();

		ThemeEditorStore.getState().begin(SESSION, draft('#000001'));
		ThemeEditorStore.getState().setDetails({ name: 'Renamed' });
		expect(ThemeEditorStore.getState().session).toEqual({ ...SESSION, name: 'Renamed' });
	});
});

describe('undo and redo', () => {
	test('walk the edits back and forth', () => {
		const store = ThemeEditorStore.getState();

		store.begin(SESSION, draft('#000001'));
		store.edit(draft('#000002'));
		store.edit(draft('#000003'));

		store.undo();
		expect(preview()).toBe('#000002');
		store.undo();
		expect(preview()).toBe('#000001');
		store.undo();
		expect(preview()).toBe('#000001');

		store.redo();
		expect(preview()).toBe('#000002');
	});

	test('an edit after undoing drops the redo history', () => {
		const store = ThemeEditorStore.getState();

		store.begin(SESSION, draft('#000001'));
		store.edit(draft('#000002'));
		store.undo();
		store.edit(draft('#000003'));
		store.redo();

		expect(preview()).toBe('#000003');
		expect(ThemeEditorStore.getState().future).toEqual([]);
	});

	test('edits without a session, or of the same draft, record nothing', () => {
		const store = ThemeEditorStore.getState();

		store.edit(draft('#000002'));
		expect(ThemeStore.getState().preview).toBeNull();

		store.begin(SESSION, draft('#000001'));
		store.edit(ThemeStore.getState().preview as Theme);
		expect(ThemeEditorStore.getState().past).toEqual([]);
	});

	test('history keeps the last 50 drafts', () => {
		const store = ThemeEditorStore.getState();

		store.begin(SESSION, draft('#000000'));

		for (let index = 1; index <= 60; index++) {
			store.edit(draft(`#${String(index).padStart(6, '0')}`));
		}

		expect(ThemeEditorStore.getState().past).toHaveLength(50);
		expect(ThemeEditorStore.getState().past[0]?.semantic.TEXT_DEFAULT?.value).toBe('#000010');
	});
});

describe('screens', () => {
	test('the mounted count never drops below zero', () => {
		const store = ThemeEditorStore.getState();

		store.mount();
		store.unmount();
		store.unmount();

		expect(ThemeEditorStore.getState().mounted).toBe(0);
	});

	test('offsets are kept per screen key', () => {
		const store = ThemeEditorStore.getState();

		store.setOffset('editor', 300);
		store.setOffset('text', 120);

		expect(ThemeEditorStore.getState().offsets).toEqual({ editor: 300, text: 120 });
	});
});
