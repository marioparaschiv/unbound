import type { NativePluginCapability } from '@unbound-app/types';

import type { Addon } from '~/addons/addon';
import { confirm } from '~/dialogs/api';

/**
 * @description Asks the user, in an alert, whether an addon may call native functions directly.
 * @param addon The addon asking.
 * @param _capabilities The consent-gated capabilities it asks for.
 * @returns Whether the user allowed it.
 */
export function askForNativeConsent(
	addon: Addon,
	_capabilities: readonly NativePluginCapability[],
): Promise<boolean> {
	return confirm('UNBOUND_FFI_CONSENT_TITLE', {
		body: 'UNBOUND_FFI_CONSENT_BODY',
		bodyVars: { name: addon.name },
		confirm: 'UNBOUND_FFI_CONSENT_ALLOW',
		destructive: true,
	});
}
