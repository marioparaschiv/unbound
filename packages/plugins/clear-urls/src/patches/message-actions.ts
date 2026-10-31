import { patcher } from '@unbound-app/api';

import { cleanUrls, compileRules } from '~/clean-urls';
import { DEFAULT_RULES } from '~/constants';
import { MessageActions } from '~/modules';

type Draft = {
	content: string;
};

const METHODS = ['sendMessage', 'editMessage'];

// UNKNOWN: a message action receives ids and option bags next to the draft.
function isDraft(arg: unknown): arg is Draft {
	return typeof (arg as Partial<Draft> | null)?.content === 'string';
}

let patched: string[] = [];

/**
 * @description Lists the message actions the patch currently cleans.
 * @returns The patched method names.
 */
export function patchedMethods(): string[] {
	return [...patched];
}

/**
 * @description Removes tracking parameters from links in messages as they are sent or edited.
 */
export function patchMessageActions(): void {
	const rules = compileRules(DEFAULT_RULES);

	// Patching the lazy handle waits for Discord to load the module; reading a method first would load it at start.
	for (const method of METHODS) {
		patcher.before(MessageActions, method, ({ args }) => {
			const draft = args.find(isDraft);

			if (draft) draft.content = cleanUrls(draft.content, rules);
		});
	}

	patched = METHODS;
}
