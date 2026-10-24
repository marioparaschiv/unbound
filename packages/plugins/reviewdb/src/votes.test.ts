import { describe, expect, test } from 'bun:test';

import type { Review } from '~/entities';
import { changeVote, withVotes } from '~/votes';

function review(id: number): Review {
	return {
		id,
		comment: 'Nice person',
		sender: { discordID: '1', username: 'author', profilePhoto: '' },
		timestamp: 0,
	};
}

describe('changeVote', () => {
	test('a first vote moves the score by one', () => {
		expect(changeVote(null, true)).toEqual({ vote: true, delta: 1 });
		expect(changeVote(null, false)).toEqual({ vote: false, delta: -1 });
	});

	test('pressing the same arrow again removes the vote', () => {
		expect(changeVote(true, true)).toEqual({ vote: null, delta: -1 });
		expect(changeVote(false, false)).toEqual({ vote: null, delta: 1 });
	});

	test('switching sides moves the score by two', () => {
		expect(changeVote(false, true)).toEqual({ vote: true, delta: 2 });
		expect(changeVote(true, false)).toEqual({ vote: false, delta: -2 });
	});
});

describe('withVotes', () => {
	test("marks each review with the viewer's vote and null where they have not voted", () => {
		const marked = withVotes(
			[review(1), review(2), review(3)],
			[
				{ reviewID: 1, isUpvote: true },
				{ reviewID: 3, isUpvote: false },
			],
		);

		expect(marked.map((item) => item.userVote)).toEqual([true, null, false]);
	});

	test("leaves the server's reviews untouched when the viewer has no votes", () => {
		const reviews = [{ ...review(1), userVote: true }];

		expect(withVotes(reviews, [])).toBe(reviews);
	});
});
