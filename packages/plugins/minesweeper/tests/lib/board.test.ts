import { describe, expect, test } from 'bun:test';

import { createBoard, formatBoard, maxMines } from '~/lib/board';

function seeded(seed: number): () => number {
	let state = seed;

	return () => {
		state = (state * 1103515245 + 12345) % 2147483648;

		return state / 2147483648;
	};
}

describe('board', () => {
	test('hides exactly the asked mines and keeps the start clear', () => {
		const board = createBoard(8, 10, [3, 4], seeded(7));

		expect(board.flat().filter((tile) => tile === -1)).toHaveLength(10);

		for (let r = 2; r <= 4; r++) {
			for (let c = 3; c <= 5; c++) expect(board[r]![c]).not.toBe(-1);
		}

		expect(board[3]![4]).toBe(0);
	});

	test('counts the mines around every tile', () => {
		const board = createBoard(6, 8, [0, 0], seeded(3));

		board.forEach((row, r) =>
			row.forEach((tile, c) => {
				if (tile === -1) return;

				let around = 0;

				for (let dr = -1; dr <= 1; dr++) {
					for (let dc = -1; dc <= 1; dc++) {
						if (board[r + dr]?.[c + dc] === -1) around++;
					}
				}

				expect(tile).toBe(around);
			}),
		);
	});

	test('writes spoiler tiles with the start tile uncovered', () => {
		const text = formatBoard(
			[
				[0, 1],
				[1, -1],
			],
			[0, 0],
		);

		expect(text).toBe('0️⃣\u200B||1️⃣||\n||1️⃣||\u200B||💥||');
		expect(text).not.toContain('||||');
	});

	test('leaves room for a clear start', () => {
		expect(maxMines(5)).toBe(16);
	});
});
