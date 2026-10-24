import { metro, toasts } from '@unbound-app/api';

import { PLUGIN_NAME } from '~/constants';

/**
 * @description Copies a code block's text and confirms the result with a toast.
 * @param code The exact text between the fences.
 * @returns `true` when the clipboard accepted the text.
 */
export async function copyCode(code: string): Promise<boolean> {
	try {
		await metro.common.Clipboard.setString(code);
	} catch {
		toasts.showToast({ title: PLUGIN_NAME, content: 'Could not copy code.' });

		return false;
	}

	toasts.showToast({ title: PLUGIN_NAME, content: 'Code copied to clipboard.' });

	return true;
}

export default { copyCode };
