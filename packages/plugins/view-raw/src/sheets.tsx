import { toasts } from '@unbound-app/api';

import { ActionSheets, Clipboard } from '~/modules';
import RawSheet from '~/components/raw-sheet';
import type { RawItem } from '~/raw-items';

function copy(value: string, label: string) {
	void Promise.resolve(Clipboard.setString(value)).then(() =>
		toasts.showToast({ title: 'View Raw', content: `${label} copied to clipboard.` }),
	);
}

/**
 * @description Opens a sheet showing an item's raw JSON, with buttons to copy it.
 * @param item The record to show.
 */
export function openRawSheet(item: RawItem): void {
	const key = `unbound-view-raw-${Date.now()}`;
	const json = JSON.stringify(item.data, null, 4);

	function close() {
		ActionSheets.hideActionSheet(key);
	}

	ActionSheets.openLazy(
		Promise.resolve({
			default: () => (
				<RawSheet
					type={item.type}
					json={json}
					content={item.content ?? ''}
					onCopy={copy}
					onClose={close}
				/>
			),
		}),
		key,
		{ onClose: close },
		{ initialSnapIndex: 1 },
	);
}

export default openRawSheet;
