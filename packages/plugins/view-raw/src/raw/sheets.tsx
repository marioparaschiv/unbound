import { messages } from '@unbound-app/i18n';
import { metro, toasts } from '@unbound-app/api';

import RawSheet from '~/raw/components/raw-sheet';
import type { RawItem } from '~/raw/raw-items';
import { ActionSheets } from '~/raw/modules';

function copy(value: string, content: string) {
	void Promise.resolve(metro.common.Clipboard.setString(value)).then(() =>
		toasts.show({ title: messages.VIEW_RAW, content }),
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
