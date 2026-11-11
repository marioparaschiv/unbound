import { metro, toasts } from '@unbound-app/api';
import { Share } from 'react-native';

import type { Ruleset } from '@unbound-plugins/shared/text-replace/stored-rules';

import { serializeRuleset } from '~/replace/ruleset';

async function copy(value: string): Promise<boolean> {
	try {
		await metro.common.Clipboard.setString(value);

		return true;
	} catch {
		return false;
	}
}

/**
 * @description Copies the ruleset JSON to the clipboard and opens the share sheet with it.
 * @param ruleset The text and regex rules.
 * @returns Resolves once the share sheet closes and the result toast is shown.
 */
export async function shareRuleset(ruleset: Ruleset): Promise<void> {
	const value = serializeRuleset(ruleset);
	const copied = await copy(value);

	try {
		await Share.share({ message: value });
		toasts.success(copied ? 'RULESET_COPIED_AND_SHARED' : 'RULESET_SHARED');
	} catch {
		if (copied) toasts.success('RULESET_COPIED');
		else toasts.warning('SHARING_UNAVAILABLE');
	}
}

/**
 * @description Reads the clipboard's text.
 * @returns The text, or an empty string when the clipboard cannot be read.
 */
export async function readClipboard(): Promise<string> {
	try {
		return await metro.common.Clipboard.getString();
	} catch {
		return '';
	}
}

export default { shareRuleset, readClipboard };
