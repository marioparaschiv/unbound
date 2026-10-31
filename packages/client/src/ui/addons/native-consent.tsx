import type { NativePluginCapability } from '@unbound-app/types';

import { Discord } from '~/api/metro/components';
import type { Addon } from '~/managers/addon';
import { format } from '~/api/i18n';

const ALERT_KEY = 'unbound-native-consent';

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
	return new Promise((resolve) => {
		let answered = false;

		function answer(granted: boolean) {
			if (answered) return;

			answered = true;
			Discord.dismissAlert(ALERT_KEY);
			resolve(granted);
		}

		Discord.openAlert(
			ALERT_KEY,
			<Discord.AlertModal
				title={format('UNBOUND_FFI_CONSENT_TITLE')}
				content={format('UNBOUND_FFI_CONSENT_BODY', { name: addon.name })}
				actions={
					<>
						<Discord.AlertActionButton
							text={format('UNBOUND_FFI_CONSENT_ALLOW')}
							variant='destructive'
							onPress={() => answer(true)}
						/>
						<Discord.AlertActionButton
							text={format('UNBOUND_CANCEL')}
							variant='secondary'
							onPress={() => answer(false)}
						/>
					</>
				}
			/>,
		);
	});
}
