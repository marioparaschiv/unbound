export const TILE = 128;
export const MAX_COLUMNS = 8;

export type Grid = { columns: number; rows: number };

export type Tile = { row: number; column: number; name: string; rgba: Uint8Array };

/**
 * @description Picks the rows that keep the artwork's shape for a number of columns.
 * @param columns The columns the user chose.
 * @param width The artwork's width.
 * @param height The artwork's height.
 * @returns The grid, at least one row.
 */
export function gridFor(columns: number, width: number, height: number): Grid {
	const ratio = width > 0 && height > 0 ? height / width : 1;

	return { columns, rows: Math.max(1, Math.round(columns * ratio)) };
}

/**
 * @description Cleans a name prefix into what Discord allows in emoji names: letters, digits and underscores.
 * @param text What the user typed.
 * @returns The prefix, at most 26 characters so the row and column suffix still fits in 32.
 */
export function cleanPrefix(text: string): string {
	return text.replace(/[^A-Za-z0-9_]/g, '').slice(0, 26);
}

/**
 * @description Names one tile so the set sorts and reads in order: `prefix_r1c2`.
 * @param prefix The cleaned prefix.
 * @param row The tile's row, from 0.
 * @param column The tile's column, from 0.
 * @returns The emoji name.
 */
export function tileName(prefix: string, row: number, column: number): string {
	return `${prefix}_r${row + 1}c${column + 1}`;
}

/**
 * @description Cuts an image's pixels, scaled to fill the grid exactly, into square tiles.
 * @param rgba The pixels, `grid.columns * TILE` wide and `grid.rows * TILE` tall.
 * @param grid The grid.
 * @param prefix The cleaned name prefix.
 * @returns The tiles, row by row.
 */
export function cutTiles(rgba: Uint8Array, grid: Grid, prefix: string): Tile[] {
	const stride = grid.columns * TILE * 4;
	const tiles: Tile[] = [];

	for (let row = 0; row < grid.rows; row++) {
		for (let column = 0; column < grid.columns; column++) {
			const tile = new Uint8Array(TILE * TILE * 4);

			for (let line = 0; line < TILE; line++) {
				const start = (row * TILE + line) * stride + column * TILE * 4;

				tile.set(rgba.subarray(start, start + TILE * 4), line * TILE * 4);
			}

			tiles.push({ row, column, name: tileName(prefix, row, column), rgba: tile });
		}
	}

	return tiles;
}

/**
 * @description Writes the message that draws the mosaic: one line of emoji per row.
 * @param uploaded Each tile's name and id, row by row.
 * @param columns The grid's columns.
 * @returns The message text.
 */
export function mosaicText(uploaded: { name: string; id: string }[], columns: number): string {
	const lines: string[] = [];

	for (let start = 0; start < uploaded.length; start += columns) {
		lines.push(
			uploaded
				.slice(start, start + columns)
				.map(({ name, id }) => `<:${name}:${id}>`)
				.join(''),
		);
	}

	return lines.join('\n');
}
