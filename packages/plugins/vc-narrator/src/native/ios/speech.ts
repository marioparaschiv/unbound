import type { NativeBridge, NativeObjectHandle } from '@unbound-app/api/native';
import { settings } from '@unbound-app/settings';

import { speechRate } from '~/lib/rates';

/**
 * @description Speaks through `AVSpeechSynthesizer` in the device's language, over Discord's own audio session, so it plays into a call as well.
 * @param native The plugin's native bridge.
 * @returns `speak`, which queues a line, and `dispose`, which stops speaking.
 */
export function speechIOS(native: NativeBridge) {
	const { objc } = native;
	let synthesizer: NativeObjectHandle | undefined;

	return {
		speak(text: string) {
			synthesizer ??= objc.call(
				objc.getClass('AVSpeechSynthesizer')!,
				'new',
			) as NativeObjectHandle;

			const utterance = objc.call(
				objc.getClass('AVSpeechUtterance')!,
				'speechUtteranceWithString:',
				text,
			) as NativeObjectHandle;

			objc.invoke(utterance, 'setRate:', [speechRate(settings.voice.rate, 'ios')]);
			objc.invoke(synthesizer, 'speakUtterance:', [utterance]);
		},
		dispose() {
			if (synthesizer) objc.invoke(synthesizer, 'stopSpeakingAtBoundary:', [0]);

			synthesizer = undefined;
		},
	};
}
