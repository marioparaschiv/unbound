import { setConsentPrompt } from '~/native/consent';

/** Asks the user, in an alert, before an addon gets direct native access. */
export function start() {
	// Required on use, so startup never evaluates the UI.
	setConsentPrompt((addon, capabilities) =>
		require('~/ui/addons/native-consent').askForNativeConsent(addon, capabilities),
	);
}

/** Refuses every consent request until the built-in starts again. */
export function stop() {
	setConsentPrompt(undefined);
}

export default { start, stop };
