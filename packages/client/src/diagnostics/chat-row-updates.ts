const UPDATE = 2;
const REMOVE = 3;

/** A row in a changeset Discord sends to its native chat view. */
export type ChangedRow = { changeType?: number; index?: number };

/** What one row update did, for a breadcrumb. */
export type RowUpdateSummary = {
	inserts: number;
	updates: number;
	removes: number;
	highestIndex: number;
	rowsAfter: number | undefined;
	fits: boolean | undefined;
};

/**
 * @description Summarises a row update against the rows the native view held before it. Removed rows keep their slot
 * until the update ends, as Discord's changeset indexes them, so every index must stay below the slots so far. A row
 * without an update or removal adds a row, as only a full list carries unchanged rows.
 * @param rows The changed rows Discord sent.
 * @param held The rows the view held before, or `undefined` when unknown.
 * @param full Whether the update replaces every row.
 * @returns The counts, the highest index, the rows after it, and whether every index fit.
 */
export function summariseRowUpdate(
	rows: ChangedRow[],
	held: number | undefined,
	full: boolean,
): RowUpdateSummary {
	let slots = full ? 0 : held;
	let fits: boolean | undefined = slots === undefined ? undefined : true;
	const summary = { inserts: 0, updates: 0, removes: 0, highestIndex: -1 };

	for (const row of rows) {
		const index = typeof row.index === 'number' ? row.index : -1;

		summary.highestIndex = Math.max(summary.highestIndex, index);

		if (row.changeType !== UPDATE && row.changeType !== REMOVE) {
			summary.inserts++;

			if (slots !== undefined && index > slots) {
				fits = false;
			}

			if (slots !== undefined) {
				slots++;
			}
		} else if (row.changeType === UPDATE || row.changeType === REMOVE) {
			if (row.changeType === UPDATE) {
				summary.updates++;
			} else {
				summary.removes++;
			}

			if (slots !== undefined && index >= slots) {
				fits = false;
			}
		}
	}

	return {
		...summary,
		rowsAfter: slots === undefined ? undefined : slots - summary.removes,
		fits,
	};
}

/**
 * @description Formats a row update for the crash breadcrumbs.
 * @param view The native view's number.
 * @param summary The update's summary.
 * @param full Whether it replaced every row.
 * @returns One breadcrumb line.
 */
export function rowUpdateBreadcrumb(
	view: number,
	summary: RowUpdateSummary,
	full: boolean,
): string {
	const counts = `+${summary.inserts} ~${summary.updates} -${summary.removes}`;
	const fit = summary.fits === false ? ' DOES NOT FIT' : '';

	return `chat rows: view ${view}${full ? ' reload' : ''} ${counts}, top index ${summary.highestIndex}, rows ${summary.rowsAfter ?? '?'}${fit}`;
}

export default { summariseRowUpdate, rowUpdateBreadcrumb };
