import { describe, expect, test } from 'bun:test';

import { findBoards } from '~/lib/boards';

const START = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';

describe('findBoards', () => {
	test('turns a full FEN into a board from the side to move', () => {
		expect(findBoards(`look at ${START}`)).toEqual([
			{
				url: `https://lichess1.org/export/fen.gif?fen=${encodeURIComponent(START)}&color=black`,
				width: 720,
				height: 720,
			},
		]);
	});

	test('fills the fields a bare placement leaves out', () => {
		const [board] = findBoards('`8/8/8/4k3/8/8/4K3/8`');

		expect(board?.url).toContain(encodeURIComponent('8/8/8/4k3/8/8/4K3/8 w - - 0 1'));
	});

	test('skips placements that are not a legal board', () => {
		expect(findBoards('8/8/8/8/8/8/8/8')).toEqual([]);
		expect(findBoards('9/8/8/4k3/8/8/4K3/8')).toEqual([]);
		expect(findBoards('a/b/c/d/e/f/g/h')).toEqual([]);
	});

	test('turns lichess game links into the game replay', () => {
		expect(
			findBoards(
				'https://lichess.org/q7ZvsdUF/black#32 and https://lichess.org/q7ZvsdUFabcd',
			),
		).toEqual([
			{ url: 'https://lichess.org/game/export/gif/q7ZvsdUF.gif', width: 720, height: 840 },
		]);
	});

	test('ignores other lichess pages', () => {
		expect(
			findBoards(
				'https://lichess.org/study/abcdefgh https://lichess.org/training https://lichess.org/analysis',
			),
		).toEqual([]);
	});

	test('keeps three boards at most, in order', () => {
		const links = ['aaaa1aaa', 'bbbb2bbb', 'cccc3ccc', 'dddd4ddd'].map(
			(id) => `https://lichess.org/${id}`,
		);

		expect(findBoards(links.join(' ')).map((board) => board.url)).toEqual(
			['aaaa1aaa', 'bbbb2bbb', 'cccc3ccc'].map(
				(id) => `https://lichess.org/game/export/gif/${id}.gif`,
			),
		);
	});
});
