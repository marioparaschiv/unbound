import type { NativeObjCBridge } from '@unbound-app/api/native';
import { metro } from '@unbound-app/api/testing';

type FeatureModule = Record<string, unknown>;

// The tests draw components and rows, so the native mention painters find no Discord classes and stay off.
export const NO_NATIVE_CLASSES = {
	native: { objc: { getClass: () => undefined } as NativeObjCBridge },
};

const placeholder = () => null;

// Each feature patches a render function in its Discord module, and every feature starts with the plugin.
const FEATURE_MODULES: Record<string, FeatureModule> = {
	'modules/chat/native/TypingIndicator.tsx': { default: placeholder },
	'modules/polls/native/PollVotesActionSheet.tsx': { default: placeholder },
	'modules/guild_sidebar/native/VoiceUserNameItem.tsx': { default: placeholder },
	'modules/reactions/native/MessageReactionsContent.tsx': {
		MessageReactionsContent: placeholder,
	},
	'modules/main_tabs_v2/native/shared_components/user_list/UsersFastList.tsx': {
		UsersFastList: placeholder,
	},
};

/**
 * Registers every feature's Discord module, with `module` standing in for the one at `path`.
 * @param module The module under test.
 * @param path The file path of the module under test.
 */
export function registerFeatureModules(module?: FeatureModule, path?: string): void {
	if (module && path) metro.register(module, path);

	for (const [other, stand] of Object.entries(FEATURE_MODULES)) {
		if (other !== path) metro.register(stand, other);
	}
}
