import type { NativeObjCBridge, NativeObjectHandle } from '@unbound-app/api/native';
import { findVisibleCells } from '@unbound-plugins/shared/native/visible-cells';

export type VisibleCellScanner = ReturnType<typeof createVisibleCellScanner>;

/**
 * @description Finds the message cells already on screen, which no cell hook reports until they lay out again.
 * @param objc The plugin's Objective-C bridge.
 * @param onCell Called with each visible `DCDMessageTableViewCell`.
 * @returns The scanner; `schedule` runs a round of scans and `cancel` stops them.
 */
export function createVisibleCellScanner(
	objc: NativeObjCBridge,
	onCell: (cell: NativeObjectHandle) => void,
) {
	let timers: ReturnType<typeof setTimeout>[] = [];
	let current: AbortController | null = null;

	// A newer scan supersedes one still in flight.
	async function scan() {
		current?.abort();

		const { signal } = (current = new AbortController());

		for (const cell of await findVisibleCells(objc, 'DCDMessageTableViewCell', signal)) {
			onCell(cell);
		}
	}

	function cancel() {
		for (const timer of timers) clearTimeout(timer);

		timers = [];
		current?.abort();
		current = null;
	}

	// Cells keep appearing while a channel loads, so scan a few times over three seconds.
	function schedule() {
		cancel();
		timers = [0, 100, 500, 1_500, 3_000].map((delay) => setTimeout(() => void scan(), delay));
	}

	return { schedule, cancel };
}

export default createVisibleCellScanner;
