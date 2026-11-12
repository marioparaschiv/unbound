import { describe, expect, test } from 'bun:test';

import {
	blurAttachments,
	blurEmbeds,
	hasEmbedMedia,
	mediaHolders,
	RowBlurrer,
	rowChannelId,
	type BlurParts,
	type ChatRow,
	type RowMessage,
} from '~/lib/blur';

describe('blurAttachments', () => {
	test('marks every attachment as a spoiler without changing the original', () => {
		const original = [
			{ id: '1', filename: 'a.png' },
			{ id: '2', isSpoiler: false, spoiler: '' },
		];
		const blurred = blurAttachments(original);

		expect(blurred).toEqual([
			{ id: '1', filename: 'a.png', isSpoiler: true, spoiler: 'SPOILER' },
			{ id: '2', isSpoiler: true, spoiler: 'SPOILER' },
		]);
		expect(original[0]).not.toHaveProperty('spoiler');
	});

	test('keeps an attachment that is already a spoiler as it is', () => {
		const spoiler = { id: '1', isSpoiler: true, spoiler: 'SPOILER' };

		expect((blurAttachments([spoiler]) as unknown[])[0]).toBe(spoiler);
	});

	test('leaves values that are not lists or entries alone', () => {
		expect(blurAttachments(undefined)).toBeUndefined();
		expect(blurAttachments([null, 'x'])).toEqual([null, 'x']);
	});
});

describe('hasEmbedMedia', () => {
	test('finds images, galleries, thumbnails and videos', () => {
		expect(hasEmbedMedia({ image: { url: 'a' } })).toBe(true);
		expect(hasEmbedMedia({ images: [{ url: 'a' }] })).toBe(true);
		expect(hasEmbedMedia({ thumbnail: { url: 'a' } })).toBe(true);
		expect(hasEmbedMedia({ video: { url: 'a' } })).toBe(true);
	});

	test('ignores text-only embeds and empty media', () => {
		expect(hasEmbedMedia({ title: 'Hi', images: [] })).toBe(false);
		expect(hasEmbedMedia({ image: null })).toBe(false);
		expect(hasEmbedMedia(null)).toBe(false);
	});
});

describe('blurEmbeds', () => {
	test('marks only embeds with media as spoilers', () => {
		const text = { title: 'Article' };

		expect(blurEmbeds([text, { video: { url: 'v' } }])).toEqual([
			text,
			{ video: { url: 'v' }, spoiler: 'SPOILER' },
		]);
	});
});

describe('rowChannelId', () => {
	test('prefers the message the row was generated from', () => {
		expect(
			rowChannelId({ message: { channel_id: 'a' } }, { message: { channelId: 'b' } }),
		).toBe('a');
	});

	test('falls back to the row', () => {
		expect(rowChannelId(undefined, { message: { channelId: 'b' } })).toBe('b');
		expect(rowChannelId({}, {})).toBeUndefined();
	});
});

describe('mediaHolders', () => {
	test('lists the message and each forwarded snapshot message', () => {
		const forwarded = { attachments: [] };
		const legacy = { embeds: [] };
		const message: RowMessage = {
			messageSnapshots: [{ message: forwarded }, null, {}],
			message_snapshots: [{ message: legacy }],
		};

		expect(mediaHolders(message)).toEqual([message as object, forwarded, legacy]);
	});

	test('is empty without a message', () => {
		expect(mediaHolders(undefined)).toEqual([]);
	});
});

describe('RowBlurrer', () => {
	const BOTH: BlurParts = { attachments: true, embeds: true };
	const NONE: BlurParts = { attachments: false, embeds: false };

	function row(): ChatRow {
		return {
			message: {
				attachments: [{ id: '1' }],
				embeds: [{ image: { url: 'i' } }],
			},
		};
	}

	test('blurs only the enabled parts in an NSFW channel', () => {
		const target = row();

		new RowBlurrer().apply(target, { attachments: true, embeds: false }, true);

		expect(target.message?.attachments).toEqual([
			{ id: '1', isSpoiler: true, spoiler: 'SPOILER' },
		]);
		expect(target.message?.embeds).toEqual([{ image: { url: 'i' } }]);
	});

	test('changes nothing outside NSFW channels', () => {
		const target = row();

		new RowBlurrer().apply(target, BOTH, false);

		expect(target).toEqual(row());
	});

	test('blurs media inside forwarded messages', () => {
		const target: ChatRow = {
			message: {
				attachments: [],
				messageSnapshots: [
					{ message: { attachments: [{ id: 'f' }], embeds: [{ video: { url: 'v' } }] } },
				],
			},
		};

		new RowBlurrer().apply(target, BOTH, true);

		expect(target.message?.messageSnapshots).toEqual([
			{
				message: {
					attachments: [{ id: 'f', isSpoiler: true, spoiler: 'SPOILER' }],
					embeds: [{ video: { url: 'v' }, spoiler: 'SPOILER' }],
				},
			},
		]);
	});

	test('restores a reused row when a part is turned off', () => {
		const target = row();
		const original = target.message?.embeds;
		const blurrer = new RowBlurrer();

		blurrer.apply(target, BOTH, true);
		blurrer.apply(target, { attachments: true, embeds: false }, true);

		expect(target.message?.embeds).toBe(original);
		expect(target.message?.attachments).toEqual([
			{ id: '1', isSpoiler: true, spoiler: 'SPOILER' },
		]);

		blurrer.apply(target, NONE, true);

		expect(target).toEqual(row());
		expect(blurrer.size).toBe(0);
	});

	test('does not stack blurs on a reused row', () => {
		const target = row();
		const blurrer = new RowBlurrer();

		blurrer.apply(target, BOTH, true);
		blurrer.apply(target, BOTH, true);
		blurrer.restoreAll();

		expect(target).toEqual(row());
	});

	test('restores every blurred row, forwarded ones included, on stop', () => {
		const first = row();
		const forwarded: ChatRow = {
			message: { messageSnapshots: [{ message: { attachments: [{ id: 'f' }] } }] },
		};
		const blurrer = new RowBlurrer();

		blurrer.apply(first, BOTH, true);
		blurrer.apply(forwarded, BOTH, true);
		blurrer.restoreAll();

		expect(first).toEqual(row());
		expect(forwarded.message?.messageSnapshots).toEqual([
			{ message: { attachments: [{ id: 'f' }] } },
		]);
		expect(blurrer.size).toBe(0);
	});

	test('keeps a list Discord replaced after the blur', () => {
		const target = row();
		const fresh = [{ id: '2' }];
		const blurrer = new RowBlurrer();

		blurrer.apply(target, BOTH, true);

		if (target.message) target.message.attachments = fresh;

		blurrer.restoreAll();

		expect(target.message?.attachments).toBe(fresh);
	});

	test('tolerates rows without a message or the part', () => {
		const blurrer = new RowBlurrer();

		expect(() => blurrer.apply(undefined, BOTH, true)).not.toThrow();
		expect(() => blurrer.apply({}, BOTH, true)).not.toThrow();

		const target: ChatRow = { message: {} };

		blurrer.apply(target, BOTH, true);

		expect(target.message).toEqual({});
		expect(blurrer.size).toBe(0);
	});
});
