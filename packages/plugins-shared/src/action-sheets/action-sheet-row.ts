import type { DesignModule } from '@unbound-app/api/metro/components';
import { BottomSheets } from '@unbound-app/api/metro/components';
export type ActionSheetRowComponent = DesignModule['ActionSheetRow'];

/**
 * @description Returns Discord's action sheet row, with the `Group` and `Icon` parts it carries, as Unbound's own sheets use it.
 * @returns The `ActionSheetRow` from Unbound's `BottomSheets` handle.
 */
export function getActionSheetRow(): ActionSheetRowComponent {
	return BottomSheets.ActionSheetRow;
}

export default getActionSheetRow;
