import type { PluginContext } from '@unbound-app/api/native';
import { flux, metro, toasts } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';
import { patchChatInputButton } from '@unbound-plugins/shared/composer/input-button';

import { mapLink } from '~/lib/coordinates';
import { currentLocation } from '~/native/location';

type ChatInput = { setText?: (text: string) => void };
type InputRegistry = {
	getBestActiveInputForChannelId?: (channelId: string) => ChatInput | null | undefined;
};
type DraftStore = { getDraft(channelId: string, draftType: number): string | undefined };

const CHANNEL_MESSAGE_DRAFT = 0;
const TOAST_ID = 'share-location';

function appendToDraft(channelId: string, text: string) {
	const drafts = flux.getStore('Draft') as unknown as DraftStore;
	const draft = drafts.getDraft(channelId, CHANNEL_MESSAGE_DRAFT) ?? '';
	const registry = metro.findByProps('getBestActiveInputForChannelId') as
		| InputRegistry
		| undefined;

	registry
		?.getBestActiveInputForChannelId?.(channelId)
		?.setText?.(draft ? `${draft} ${text}` : text);
}

async function share(context: PluginContext, channelId: string) {
	const locating = toasts.show({ id: TOAST_ID, title: messages.LOCATING });

	try {
		appendToDraft(channelId, mapLink(await currentLocation(context.native)));
		locating.close();
	} catch (error) {
		const denied = error instanceof Error && error.message === 'denied';

		toasts.show({
			id: TOAST_ID,
			title: denied ? messages.DENIED : messages.FAILED,
			content: denied ? undefined : String(error),
		});
	}
}

export function start(context: PluginContext) {
	patchChatInputButton({
		key: 'unbound-share-location',
		name: 'Share Location',
		icon: 'GlobeEarthIcon',
		label: () => messages.SHARE_BUTTON,
		onPress: (channelId) => void share(context, channelId),
	});
}

export function stop() {}
