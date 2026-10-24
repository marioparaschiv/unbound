import { describe, expect, test } from 'bun:test';

import { getReviewPermissions } from '~/permissions';
import type { Review } from '~/entities';

const ME = '100';
const AUTHOR = '200';
const PROFILE = '300';

function review(id: number, author: string): Review {
	return {
		id,
		comment: 'Nice person',
		sender: { discordID: author, username: 'author', profilePhoto: '' },
		timestamp: 0,
	};
}

describe('getReviewPermissions', () => {
	test('a stranger may vote and report but not delete or block', () => {
		expect(
			getReviewPermissions(review(1, AUTHOR), PROFILE, { id: ME, isAdmin: false }),
		).toEqual({ vote: true, delete: false, report: true, block: false });
	});

	test('the author may delete their review but not report it', () => {
		expect(getReviewPermissions(review(1, ME), PROFILE, { id: ME, isAdmin: false })).toEqual({
			vote: true,
			delete: true,
			report: false,
			block: false,
		});
	});

	test('the profile owner may delete, report and block reviews by others', () => {
		expect(getReviewPermissions(review(1, AUTHOR), ME, { id: ME, isAdmin: false })).toEqual({
			vote: true,
			delete: true,
			report: true,
			block: true,
		});
	});

	test('the profile owner may not block themselves', () => {
		expect(getReviewPermissions(review(1, ME), ME, { id: ME, isAdmin: false }).block).toBe(
			false,
		);
	});

	test('an admin may delete any review', () => {
		expect(
			getReviewPermissions(review(1, AUTHOR), PROFILE, { id: ME, isAdmin: true }).delete,
		).toBe(true);
	});

	test('an unknown viewer may only vote', () => {
		expect(
			getReviewPermissions(review(1, AUTHOR), PROFILE, { id: undefined, isAdmin: true }),
		).toEqual({ vote: true, delete: false, report: false, block: false });
	});

	test('review 0 cannot be voted on', () => {
		expect(
			getReviewPermissions(review(0, AUTHOR), PROFILE, { id: ME, isAdmin: false }).vote,
		).toBe(false);
	});
});
