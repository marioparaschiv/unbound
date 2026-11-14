import type { PluginContext } from '@unbound-app/api/native';

import { listenToVoiceStates } from '~/flux/listeners';
import { createSpeech } from '~/native/speech';

let speech: ReturnType<typeof createSpeech> | undefined;

export function start(context: PluginContext) {
	speech = createSpeech(context.native);
	listenToVoiceStates((text) => speech?.speak(text));
}

export function stop() {
	speech?.dispose();
	speech = undefined;
}
