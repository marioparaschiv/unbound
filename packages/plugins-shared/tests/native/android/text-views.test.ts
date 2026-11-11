import { installAddonGlobals } from '@unbound-app/api/testing';
import { afterEach, describe, expect, test } from 'bun:test';

import { watchTextViews, type TextViews } from '~/native/android/text-views';

import {
	DRAWEE_TEXT_VIEW,
	fakeMessageText,
	MESSAGE_CONTENT_VIEW,
	settle,
	viewKey,
} from '../../helpers/fake-message-text';

installAddonGlobals();

let views: TextViews | undefined;

afterEach(() => {
	views?.dispose();
	views = undefined;
});

function watch(className: string, draw: (key: string) => Promise<void> = async () => {}) {
	const android = fakeMessageText();
	const drawn: string[] = [];

	views = watchTextViews(android.native, {
		className,
		draw: async (view) => {
			drawn.push(viewKey(view));
			await draw(viewKey(view));
		},
	});

	return { android, drawn };
}

describe('watchTextViews', () => {
	test('draws a view once for the texts set on it before the draw runs', async () => {
		const { android, drawn } = watch(DRAWEE_TEXT_VIEW);
		const view = android.textView();

		android.setText(view, 'one');
		android.setText(view, 'two');
		await settle();
		android.setText(view, 'three');
		await settle();

		expect(drawn).toEqual([viewKey(view), viewKey(view)]);
	});

	test('draws only views of the watched class', async () => {
		const { android, drawn } = watch(MESSAGE_CONTENT_VIEW);
		const content = android.contentView();

		android.setText(android.textView(), 'a username');
		android.setText(content, 'a message');
		await settle();

		expect(drawn).toEqual([viewKey(content)]);
	});

	test('is busy while a draw waits or runs', async () => {
		let release = () => {};
		const { android } = watch(DRAWEE_TEXT_VIEW, () => new Promise((done) => (release = done)));

		android.setText(android.textView(), 'text');

		expect(views?.busy()).toBe(true);

		await settle();

		expect(views?.busy()).toBe(true);

		release();
		await settle();

		expect(views?.busy()).toBe(false);
	});

	test('draws no view once disposed, even one already waiting', async () => {
		const { android, drawn } = watch(DRAWEE_TEXT_VIEW);
		const view = android.textView();

		android.setText(view, 'before');
		views?.dispose();
		android.setText(view, 'after');
		await settle();

		expect(drawn).toEqual([]);
	});
});
