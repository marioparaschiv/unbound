import { beforeAll, expect, test } from 'bun:test';
import { metro, toasts } from '@unbound-app/api/testing';

import { copyCode } from '~/codeblocks/clipboard';

const copied: string[] = [];
const clipboard = { refuses: false };

beforeAll(() => {
	metro.register({
		setString: (text: string) => {
			if (clipboard.refuses) throw new Error('denied');

			copied.push(text);
		},
		getString: () => '',
		setImage: () => {},
		getImage: () => '',
	});
});

test('copies the code and confirms with a toast', async () => {
	expect(await copyCode('const a = 1;')).toBe(true);
	expect(copied).toEqual(['const a = 1;']);
	expect(toasts.shown).toMatchObject([
		{ title: 'Shiki Codeblocks', content: 'Code copied to clipboard.' },
	]);
});

test('says so when the clipboard refuses', async () => {
	clipboard.refuses = true;

	expect(await copyCode('x')).toBe(false);
	expect(toasts.shown).toMatchObject([{ content: 'Could not copy code.' }]);
});
