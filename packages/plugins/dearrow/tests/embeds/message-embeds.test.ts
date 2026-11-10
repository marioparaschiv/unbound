import { describe, expect, test } from 'bun:test';

import {
	canDearrow,
	copyWith,
	dearrowMessage,
	messageVideoIds,
	replaceEmbed,
	selectReplacements,
	type Embed,
} from '~/embeds/message-embeds';
import type { Branding } from '~/embeds/branding';

const ID = 'dQw4w9WgXcQ';
const OTHER = 'aaaaaaaaaaa';
const BRANDING: Branding = { title: 'Calm title', thumbnail: 'https://thumb/1' };

function youtube(id: string): Embed {
	return {
		url: `https://www.youtube.com/watch?v=${id}`,
		rawTitle: 'YOU WONT BELIEVE THIS',
		provider: { name: 'YouTube' },
		video: { url: `https://www.youtube.com/embed/${id}` },
		thumbnail: { url: 'https://i.ytimg.com/a.jpg', proxyURL: 'https://images/a.jpg' },
	};
}

const link: Embed = { url: 'https://example.com', rawTitle: 'Example' };

class Record {
	id = '1';
	embeds: Embed[] = [youtube(ID), link];

	hasFlag() {
		return false;
	}
}

const source = (videoId: string) => (videoId === ID ? BRANDING : undefined);

describe('selectReplacements', () => {
	test('keeps both parts for everything', () => {
		expect(selectReplacements(BRANDING, 'all')).toEqual(BRANDING);
	});

	test('keeps only the title', () => {
		expect(selectReplacements(BRANDING, 'titles')).toEqual({ title: 'Calm title' });
	});

	test('keeps only the thumbnail', () => {
		expect(selectReplacements(BRANDING, 'thumbnails')).toEqual({
			thumbnail: 'https://thumb/1',
		});
	});

	test('returns null when the mode leaves nothing', () => {
		expect(selectReplacements({ title: 'x' }, 'thumbnails')).toBeNull();
		expect(selectReplacements({ thumbnail: 'x' }, 'titles')).toBeNull();
		expect(selectReplacements(null, 'all')).toBeNull();
		expect(selectReplacements(undefined, 'all')).toBeNull();
	});
});

describe('replaceEmbed', () => {
	test('replaces the title and the proxied thumbnail without touching the original', () => {
		const embed = youtube(ID);
		const replaced = replaceEmbed(embed, BRANDING);

		expect(replaced.rawTitle).toBe('Calm title');
		expect(replaced.thumbnail).toEqual({
			url: 'https://i.ytimg.com/a.jpg',
			proxyURL: 'https://thumb/1',
		});
		expect(embed.rawTitle).toBe('YOU WONT BELIEVE THIS');
		expect(embed.thumbnail?.proxyURL).toBe('https://images/a.jpg');
	});

	test('does not add a thumbnail to an embed without one', () => {
		const { thumbnail: _, ...embed } = youtube(ID);

		expect(replaceEmbed(embed, BRANDING).thumbnail).toBeUndefined();
	});
});

describe('messageVideoIds', () => {
	test('lists each YouTube video once', () => {
		expect(
			messageVideoIds({ embeds: [youtube(ID), link, youtube(OTHER), youtube(ID)] }),
		).toEqual([ID, OTHER]);
	});

	test('handles messages without embeds', () => {
		expect(messageVideoIds({})).toEqual([]);
		expect(messageVideoIds(undefined)).toEqual([]);
	});
});

describe('canDearrow', () => {
	test('is true when an embed has branding for the mode', () => {
		expect(canDearrow(new Record(), source, 'all')).toBe(true);
	});

	test('is false without branding', () => {
		expect(canDearrow({ embeds: [youtube(OTHER)] }, source, 'all')).toBe(false);
	});

	test('is false when the mode leaves nothing', () => {
		expect(canDearrow(new Record(), () => ({ title: 'x' }), 'thumbnails')).toBe(false);
	});
});

describe('copyWith', () => {
	test('keeps the prototype and the other fields', () => {
		const record = new Record();
		const copy = copyWith(record, { id: '2' });

		expect(copy).toBeInstanceOf(Record);
		expect(copy.hasFlag()).toBe(false);
		expect(copy.id).toBe('2');
		expect(copy.embeds).toBe(record.embeds);
		expect(record.id).toBe('1');
	});
});

describe('dearrowMessage', () => {
	test('replaces only the YouTube embeds with branding', () => {
		const record = new Record();
		const dearrowed = dearrowMessage(record, source, 'all');

		expect(dearrowed).toBeInstanceOf(Record);
		expect(dearrowed?.embeds.at(0)?.rawTitle).toBe('Calm title');
		expect(dearrowed?.embeds[1]).toBe(link);
		expect(record.embeds[0]?.rawTitle).toBe('YOU WONT BELIEVE THIS');
	});

	test('returns undefined when nothing changes', () => {
		expect(dearrowMessage({ embeds: [link, youtube(OTHER)] }, source, 'all')).toBeUndefined();
		expect(dearrowMessage(undefined, source, 'all')).toBeUndefined();
	});

	test('asks the source for every YouTube embed', () => {
		const asked: string[] = [];

		dearrowMessage(
			{ embeds: [youtube(ID), youtube(OTHER)] },
			(id) => {
				asked.push(id);

				return undefined;
			},
			'all',
		);

		expect(asked).toEqual([ID, OTHER]);
	});
});
