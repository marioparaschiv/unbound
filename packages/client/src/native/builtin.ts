import { askForNativeConsent } from '~/ui/addons/native-consent';
import { setConsentPrompt } from '~/native/consent';

/** Asks the user, in an alert, before an addon gets direct native access. */
export function start() {
	setConsentPrompt(askForNativeConsent);
}

/** Refuses every consent request until the built-in starts again. */
export function stop() {
	setConsentPrompt(undefined);
}

export default { start, stop };
