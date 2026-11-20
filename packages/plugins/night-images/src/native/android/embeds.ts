/**
 * @description Leaves embed images alone on Android, where only attachments are dimmed.
 * @returns A function that does nothing.
 */
export function dimAndroidEmbeds(): () => Promise<void> {
	return async () => {};
}
