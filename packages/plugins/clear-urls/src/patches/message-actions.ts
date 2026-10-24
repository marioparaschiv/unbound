import { MessageActions, Patcher } from '~/modules';
import { cleanUrls, compileRules } from '~/clean-urls';
import { DEFAULT_RULES } from '~/constants';

type Draft = {
	content: string;
};

// UNKNOWN: a message action receives ids and option bags next to the draft.
function isDraft(arg: unknown): arg is Draft {
	return typeof (arg as Partial<Draft> | null)?.content === 'string';
}

/**
 * @description Removes tracking parameters from links in messages as they are sent or edited.
 * @returns A function that removes the patches.
 */
export function patchMessageActions(): () => void {
	const rules = compileRules(DEFAULT_RULES);

	const unpatches = ['sendMessage', 'editMessage']
		.filter((method) => typeof MessageActions[method] === 'function')
		.map((method) =>
			Patcher.before(MessageActions, method, ({ args }) => {
				const draft = args.find(isDraft);

				if (draft) draft.content = cleanUrls(draft.content, rules);
			}),
		);

	return () => {
		for (const unpatch of unpatches) unpatch();
	};
}
