import { clearSaved } from '~/archive/runtime';
import { openSavedArchive } from '~/archive/sheet';
export function viewSavedArchive(): void {
	openSavedArchive();
}
export async function clearSavedAccount(): Promise<void> {
	await clearSaved(false);
}
export async function clearAllSavedAccounts(): Promise<void> {
	await clearSaved(true);
}
