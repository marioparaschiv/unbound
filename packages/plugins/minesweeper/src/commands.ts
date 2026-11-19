import { commands } from '@unbound-app/api';
import { format } from '@unbound-app/i18n';

import { createBoard, formatBoard, MAX_SIZE, maxMines, MIN_SIZE } from '~/lib/board';

const DEFAULT_SIZE = 8;
const MINE_SHARE = 0.16;

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * @description Adds `/minesweeper`, which sends a board of spoiler tiles with one safe tile already open.
 */
export function registerMinesweeper(): void {
	commands.register({
		minesweeper: {
			description: 'MINESWEEPER_DESC',
			options: {
				size: commands.option.integer({ description: 'MINESWEEPER_SIZE' }),
				mines: commands.option.integer({ description: 'MINESWEEPER_MINES' }),
			},
			execute({ size, mines }) {
				const side = clamp(size ?? DEFAULT_SIZE, MIN_SIZE, MAX_SIZE);
				const count = Math.max(1, Math.round(mines ?? side * side * MINE_SHARE));

				if (count > maxMines(side)) {
					return {
						content: format('TOO_MANY_MINES', { size: side, max: maxMines(side) }),
						ephemeral: true,
					};
				}

				const start: [number, number] = [
					Math.floor(Math.random() * side),
					Math.floor(Math.random() * side),
				];
				const board = createBoard(side, count, start);

				return {
					content: `${format('HEADER', { mines: count })}\n${formatBoard(board, start)}`,
				};
			},
		},
	});
}

export default { registerMinesweeper };
