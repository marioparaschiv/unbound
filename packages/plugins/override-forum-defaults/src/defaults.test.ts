import { describe, expect, test } from 'bun:test';

import { defaultLayout, defaultSortOrder, layoutChoice, sortOrderChoice } from '~/defaults';

const forum = {
	isMediaChannel: () => false,
	isGameInvitesChannel: () => false,
};
const media = { isMediaChannel: () => true, isGameInvitesChannel: () => false };
const gameInvites = {
	isMediaChannel: () => false,
	isGameInvitesChannel: () => true,
};

describe('layoutChoice', () => {
	test('keeps a known choice', () => {
		expect(layoutChoice('gallery')).toBe('gallery');
		expect(layoutChoice('list')).toBe('list');
	});

	test('falls back to list for a missing or unknown value', () => {
		expect(layoutChoice(undefined)).toBe('list');
		expect(layoutChoice('grid')).toBe('list');
		expect(layoutChoice(2)).toBe('list');
		expect(layoutChoice('toString')).toBe('list');
	});
});

describe('sortOrderChoice', () => {
	test('keeps a known choice', () => {
		expect(sortOrderChoice('datePosted')).toBe('datePosted');
		expect(sortOrderChoice('recentlyActive')).toBe('recentlyActive');
	});

	test('falls back to recently active for a missing or unknown value', () => {
		expect(sortOrderChoice(undefined)).toBe('recentlyActive');
		expect(sortOrderChoice('newest')).toBe('recentlyActive');
		expect(sortOrderChoice(1)).toBe('recentlyActive');
	});
});

describe('defaultLayout', () => {
	test('maps the choice to Discord ForumLayout values', () => {
		expect(defaultLayout(forum, 'list', () => 2)).toBe(1);
		expect(defaultLayout(forum, 'gallery', () => 1)).toBe(2);
	});

	test('overrides the layout the server set', () => {
		expect(defaultLayout(forum, undefined, () => 2)).toBe(1);
	});

	test('keeps Discord default in media and game invite channels', () => {
		expect(defaultLayout(media, 'list', () => 2)).toBe(2);
		expect(defaultLayout(gameInvites, 'list', () => 2)).toBe(2);
	});

	test('overrides a channel record without the type checks', () => {
		expect(defaultLayout({}, 'gallery', () => 1)).toBe(2);
		expect(defaultLayout(undefined, 'gallery', () => 1)).toBe(2);
	});
});

describe('defaultSortOrder', () => {
	test('maps the choice to Discord ThreadSortOrder values', () => {
		expect(defaultSortOrder(forum, 'recentlyActive', () => 1)).toBe(0);
		expect(defaultSortOrder(forum, 'datePosted', () => 0)).toBe(1);
	});

	test('overrides in media channels', () => {
		expect(defaultSortOrder(media, 'datePosted', () => 0)).toBe(1);
	});

	test('keeps Discord default in game invite channels', () => {
		expect(defaultSortOrder(gameInvites, 'recentlyActive', () => 1)).toBe(1);
	});

	test('does not read Discord default when it overrides', () => {
		let reads = 0;

		defaultSortOrder(forum, 'datePosted', () => reads++);
		defaultLayout(forum, 'list', () => reads++);

		expect(reads).toBe(0);
	});
});
