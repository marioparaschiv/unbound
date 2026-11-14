/** An alert as Discord's legacy alert module takes it. */
export type AlertOptions = { title?: unknown; onConfirm?: () => void };

/**
 * @description Tells Discord's delete-message confirmation apart from other alerts.
 * @param options The alert.
 * @param title Discord's "Delete Message" title.
 * @returns Whether it confirms a message delete.
 */
export function isDeleteConfirmation(options: AlertOptions | undefined, title: string): boolean {
	return options?.title === title && typeof options.onConfirm === 'function';
}
