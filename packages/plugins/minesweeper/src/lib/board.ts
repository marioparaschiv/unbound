/** Tiles per side the command accepts. */
export const MIN_SIZE = 5;
export const MAX_SIZE = 10;

/** A board: `-1` is a mine, any other number counts the mines touching that tile. */
export type Board = number[][];

const NUMBERS = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'];
const MINE = '💥';
const TILE_SEPARATOR = '\u200B';

/**
 * @description The most mines a board of this size can hold while one tile and its neighbours stay clear to start from.
 * @param size Tiles per side.
 * @returns The mine limit.
 */
export function maxMines(size: number): number {
	return size * size - 9;
}

function neighbours(size: number, row: number, column: number): [number, number][] {
	const around: [number, number][] = [];

	for (let dr = -1; dr <= 1; dr++) {
		for (let dc = -1; dc <= 1; dc++) {
			const r = row + dr;
			const c = column + dc;

			if ((dr || dc) && r >= 0 && c >= 0 && r < size && c < size) around.push([r, c]);
		}
	}

	return around;
}

/**
 * @description Lays out a board, keeping the tile at `start` and its neighbours free of mines so the game opens on a zero.
 * @param size Tiles per side.
 * @param mines How many mines to hide.
 * @param start The tile to keep clear.
 * @param random A source of numbers in [0, 1).
 * @returns The board.
 */
export function createBoard(
	size: number,
	mines: number,
	start: [number, number],
	random: () => number = Math.random,
): Board {
	const board: Board = Array.from({ length: size }, () => Array<number>(size).fill(0));
	const clear = new Set([start, ...neighbours(size, ...start)].map(([r, c]) => r * size + c));
	const open = Array.from({ length: size * size }, (_, index) => index).filter(
		(index) => !clear.has(index),
	);

	for (let placed = 0; placed < mines && open.length; placed++) {
		const [index] = open.splice(Math.floor(random() * open.length), 1);
		const row = Math.floor(index! / size);
		const column = index! % size;

		board[row]![column] = -1;

		for (const [r, c] of neighbours(size, row, column)) {
			if (board[r]![c] !== -1) board[r]![c]! += 1;
		}
	}

	return board;
}

/**
 * @description Writes a board as Discord emoji in spoilers, leaving the start tile uncovered. Tiles are split by a
 * zero-width space, since Discord pairs the bars of touching spoilers (`||a||||b||`) wrongly and reveals two at once.
 * @param board The board.
 * @param start The tile shown uncovered.
 * @returns One line of tiles per row.
 */
export function formatBoard(board: Board, start: [number, number]): string {
	return board
		.map((row, r) =>
			row
				.map((tile, c) => {
					const emoji = tile === -1 ? MINE : NUMBERS[tile]!;

					return r === start[0] && c === start[1] ? emoji : `||${emoji}||`;
				})
				.join(TILE_SEPARATOR),
		)
		.join('\n');
}

export default { createBoard, formatBoard, maxMines, MIN_SIZE, MAX_SIZE };
