import type { InstallKind } from '~/updates/install-kind';
import { getLoader } from '~/native/unbound-native';
import { messages, format } from '~/i18n/api';

const MESSAGES = {
	ipa: 'UNBOUND_UPDATES_LOADER_REQUIRED_IPA',
	tweak: 'UNBOUND_UPDATES_LOADER_REQUIRED_TWEAK',
	apk: 'UNBOUND_UPDATES_LOADER_REQUIRED_APK',
	module: 'UNBOUND_UPDATES_LOADER_REQUIRED_MODULE',
} as const satisfies Record<InstallKind, string>;

/**
 * @description Words the loader requirement for how the user installed Unbound: their IPA, tweak, APK or module.
 * @param required The loader version the newest bundle needs.
 * @param kind How the loader was installed, if known.
 * @returns The message; only without a known install does it name the loader versions.
 */
export function describeRequiredLoader(required: string, kind: InstallKind | undefined): string {
	if (!kind) {
		return format('UNBOUND_UPDATES_LOADER_REQUIRED_DESC', {
			required,
			installed: getLoader()?.version ?? 'unknown',
		});
	}

	return messages[MESSAGES[kind]];
}

export default describeRequiredLoader;
