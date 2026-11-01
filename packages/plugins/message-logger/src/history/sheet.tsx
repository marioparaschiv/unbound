import { ActionSheets } from '~/discord/modules';
import HistorySheet from '~/history/components/history-sheet';
import type { EditEntry } from '~/log';

let openKey: string | null = null;

/**
 * @description Closes the history sheet if one is open.
 */
export function closeHistorySheet(): void {
	if (openKey) ActionSheets.hideActionSheet(openKey);

	openKey = null;
}

/**
 * @description Opens a sheet listing a message's earlier versions.
 * @param current The message's current text.
 * @param edits The logged edits.
 */
export function openHistorySheet(current: string, edits: readonly EditEntry[]): void {
	const key = `unbound-message-logger-${Date.now()}`;

	function close() {
		ActionSheets.hideActionSheet(key);

		if (openKey === key) openKey = null;
	}

	closeHistorySheet();
	openKey = key;

	ActionSheets.openLazy(
		Promise.resolve({ default: () => <HistorySheet current={current} edits={edits} /> }),
		key,
		{ onClose: close },
		{ initialSnapIndex: 1 },
	);
}

export default openHistorySheet;
