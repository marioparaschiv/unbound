import type { ComponentType } from 'react';
import { metro } from '@unbound-app/api';

export type SheetProps = {
	onClose: () => void;
};

/**
 * @description Opens a component as a Discord action sheet that can close itself.
 * @template P The sheet's own props.
 * @param key A key unique to this sheet.
 * @param Sheet The sheet component, which also receives `onClose`.
 * @param props The sheet's own props.
 */
export function openSheet<P>(key: string, Sheet: ComponentType<P & SheetProps>, props: P): void {
	const { ActionSheets } = metro.api;

	ActionSheets.openLazy(Promise.resolve({ default: Sheet }), key, {
		...props,
		onClose: () => ActionSheets.hideActionSheet(key),
	});
}

export default openSheet;
