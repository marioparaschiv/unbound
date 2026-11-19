import { expect, test } from 'bun:test';

import { emojiMarkdown } from '~/lib/emoji-markdown';

const known = { cozy: { id: '1', animated: false }, nod: { id: '2', animated: true } };

test('turns known shortcodes into emoji markdown, even side by side', () => {
	expect(emojiMarkdown('hi :cozy::nod: :other: <:cozy:9>', known)).toBe(
		'hi <:cozy:1><a:nod:2> :other: <:cozy:9>',
	);
});
