import { toast } from 'sonner';

/**
 * @description Copies text to the clipboard and toasts the outcome.
 * @param text The text to copy.
 * @param label What the text is, for the toasts, e.g. `addon ID`.
 */
async function copyText(text: string, label: string) {
	try {
		await navigator.clipboard.writeText(text);
		toast.success('Copied to clipboard');
	} catch (error) {
		toast.error(`Failed to copy the ${label}, copy it by hand: ${String(error)}`);
	}
}

export default copyText;
