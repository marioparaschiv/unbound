import patchLazySheets from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { insertSheetRows } from '@unbound-plugins/shared/action-sheets/sheet-rows';
import type { NativeBridge, PluginContext } from '@unbound-app/api/native';
import { metro, patcher, toasts } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';

import { audioOf, type TranscriptFailure, type VoiceMessage } from '~/lib/voice';
import { openTranscript } from '~/transcript-page';
import { createSegmentPlayer } from '~/native/segment-player';
import { transcribe } from '~/native/transcribe';

type SheetProps = { message?: VoiceMessage & { id?: string } };

const FAILURES: Record<TranscriptFailure, string> = {
	'needs-sideload': 'NEEDS_SIDELOAD',
	'not-allowed': 'NOT_ALLOWED',
	unavailable: 'UNAVAILABLE',
	'no-speech': 'NO_SPEECH',
	failed: 'FAILED',
};

function show(content: string) {
	toasts.show({ title: addon.name, content });
}

async function transcribeMessage(native: NativeBridge, url: string, messageId: string | undefined) {
	show(messages.TRANSCRIBING);

	try {
		const result = await transcribe(native, url);

		if ('text' in result) {
			openTranscript({
				text: result.text,
				segments: result.segments,
				player: result.audioPath
					? createSegmentPlayer(native, result.audioPath)
					: undefined,
			});

			return;
		}

		if (result.detail)
			logger.warn(`Transcript of message ${messageId} failed: ${result.detail}`);

		show(messages[FAILURES[result.failure] as keyof typeof messages]);
	} catch (error) {
		logger.error(`Failed to transcribe message ${messageId}:`, error);
		show(messages.FAILED);
	}
}

export function start(context: PluginContext) {
	const { ActionSheets } = metro.api;

	if (!ActionSheets) {
		logger.warn('Voice transcripts skipped: Discord moved ActionSheets.');

		return;
	}

	patchLazySheets<SheetProps>(patcher, ActionSheets, (key, props) => {
		const url = audioOf(props.message);

		if (!key.endsWith('MessageLongPressActionSheet') || !url) return;

		return (result) => {
			insertSheetRows(result, [
				{
					key: 'unbound-voice-transcript',
					label: messages.TRANSCRIBE,
					icon: 'MicrophoneIcon',
					onPress: () => {
						ActionSheets.hideActionSheet(key);
						void transcribeMessage(context.native, url, props.message?.id);
					},
				},
			]);

			return result;
		};
	});
}

export function stop() {
	patcher.unpatchAll();
}
