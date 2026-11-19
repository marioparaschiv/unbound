import type { NativeObjCBridge, NativeObjectHandle } from '@unbound-app/api/native';
import { safeInvokeAsync } from '@unbound-plugins/shared/native/ios/safe-invoke';

/**
 * @description Takes the badge out of its cell's header and lays the cell out again, so Discord puts the name back.
 * @param objc The Objective-C bridge from `context.native`.
 * @param icon The badge.
 * @param cell The message cell it sits in.
 */
export async function removeBadge(
	objc: NativeObjCBridge,
	icon: NativeObjectHandle,
	cell: NativeObjectHandle,
): Promise<void> {
	await safeInvokeAsync(objc, icon, 'removeFromSuperview');
	await safeInvokeAsync(objc, cell, 'setNeedsLayout');
}

async function nameContainer(
	objc: NativeObjCBridge,
	cell: NativeObjectHandle,
): Promise<NativeObjectHandle | undefined> {
	const container = objc.getIvar(cell, '_usernameContainerView') as NativeObjectHandle | null;
	const row = container
		? ((await safeInvokeAsync(objc, container, 'superview')) as NativeObjectHandle | null)
		: null;

	if (!container || !row || (await safeInvokeAsync(objc, row, 'isHidden'))) return undefined;

	return container;
}

/**
 * @description Whether a message cell shows its name row; a message grouped under the one before hides it.
 * @param objc The Objective-C bridge from `context.native`.
 * @param cell The message cell.
 * @returns Whether the cell shows a name row to hold the badge.
 */
export async function showsNameRow(
	objc: NativeObjCBridge,
	cell: NativeObjectHandle,
): Promise<boolean> {
	return Boolean(await nameContainer(objc, cell));
}

/**
 * @description Adds the badge to a message cell's name container and lays the cell out again, where `placeBadge` puts
 * it before the name.
 * @param objc The Objective-C bridge from `context.native`.
 * @param icon The icon from `createIcon`.
 * @param cell The message cell.
 * @returns Whether the cell still shows a name row to hold the badge.
 */
export async function addBadge(
	objc: NativeObjCBridge,
	icon: NativeObjectHandle,
	cell: NativeObjectHandle,
): Promise<boolean> {
	const container = await nameContainer(objc, cell);

	if (!container) return false;

	await safeInvokeAsync(objc, container, 'addSubview:', icon);
	await safeInvokeAsync(objc, cell, 'setNeedsLayout');

	return true;
}

export default { addBadge, removeBadge, showsNameRow };
