import { beforeEach, describe, expect, test } from 'bun:test';
import type { Theme } from '@unbound-app/types';

import type { ThemeEditorSession } from './theme-editor';

import ThemeEditorStore from './theme-editor';
import ThemeStore from './themes';

const initial: Theme = { type: 'midnight', raw: {}, semantic: {} };
const session: ThemeEditorSession = {
	id: 'local--abc',
	initial,
	name: '',
	description: '',
};

beforeEach(() => {
	ThemeEditorStore.getState().end();
	ThemeEditorStore.setState({ focused: 0 });
	ThemeStore.getState().setPreview(null);
});

describe('theme editor session', () => {
	test('begin draws the opening bundle as the preview', () => {
		ThemeEditorStore.getState().begin(session);

		expect(ThemeEditorStore.getState().session).toEqual(session);
		expect(ThemeStore.getState().preview).toBe(initial);
	});

	test('the draft outlives leaving the editor until end', () => {
		ThemeEditorStore.getState().begin(session);
		ThemeEditorStore.getState().focus();
		ThemeEditorStore.getState().blur();

		expect(ThemeStore.getState().preview).toBe(initial);

		ThemeEditorStore.getState().end();

		expect(ThemeEditorStore.getState().session).toBeNull();
		expect(ThemeStore.getState().preview).toBeNull();
	});

	test('end is idempotent and leaves a later preview alone', () => {
		ThemeEditorStore.getState().begin(session);
		ThemeEditorStore.getState().end();

		const later: Theme = { ...initial, type: 'light' };

		ThemeStore.getState().setPreview(later);
		ThemeEditorStore.getState().end();

		expect(ThemeStore.getState().preview).toBe(later);
	});

	test('details update the open session only', () => {
		ThemeEditorStore.getState().setDetails({ name: 'Ghost' });

		expect(ThemeEditorStore.getState().session).toBeNull();

		ThemeEditorStore.getState().begin(session);
		ThemeEditorStore.getState().setDetails({ name: 'Mine' });

		expect(ThemeEditorStore.getState().session?.name).toBe('Mine');
		expect(ThemeEditorStore.getState().session?.description).toBe('');
	});

	test('focus counts editor screens and never drops below zero', () => {
		const { focus, blur } = ThemeEditorStore.getState();

		focus();
		focus();
		blur();

		expect(ThemeEditorStore.getState().focused).toBe(1);

		blur();
		blur();

		expect(ThemeEditorStore.getState().focused).toBe(0);
	});
});
