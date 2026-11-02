import type { NativePluginCapability } from '@unbound-app/types';

import type { Addon } from '~/addons/addon';
import { confirm } from '~/dialogs/api';
import { format } from '~/i18n/api';

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
	return confirm({
		title: format('UNBOUND_FFI_CONSENT_TITLE'),
		body: format('UNBOUND_FFI_CONSENT_BODY', { name: addon.name }),
		confirmLabel: format('UNBOUND_FFI_CONSENT_ALLOW'),
		cancelLabel: format('UNBOUND_CANCEL'),
		destructive: true,
	});
}
