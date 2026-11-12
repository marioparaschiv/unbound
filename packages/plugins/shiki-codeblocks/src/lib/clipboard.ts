import { messages } from '@unbound-app/i18n';
import { metro, toasts } from '@unbound-app/api';

/**
 * @description Copies a code block's text and confirms the result with a toast.
 * @param code The exact text between the fences.
 * @returns `true` when the clipboard accepted the text.
 */
export async function copyCode(code: string): Promise<boolean> {
	try {
		await metro.common.Clipboard.setString(code);
	} catch {
		toasts.show({ title: messages.SHIKI_CODEBLOCKS, content: messages.COULD_NOT_COPY });

		return false;
	}

	toasts.show({ title: messages.SHIKI_CODEBLOCKS, content: messages.CODE_COPIED });

	return true;
}

export default { copyCode };
