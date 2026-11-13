import { flux, metro } from '@unbound-app/api';

import { readLastChannel, saveLastChannel } from '~/lib/last-channel';

type ChannelSelect = { channelId?: string | null; guildId?: string | null };

let switching = false;
let restored = false;

function openLastChannel() {
	const last = readLastChannel();
	const Router = metro.findByProps('transitionToChannel');

	if (!last || typeof Router?.transitionToChannel !== 'function') return;

	if (!flux.getStore('Channel').getChannel(last)) return;

	if (flux.getStore('SelectedChannel').getChannelId() === last) return;

	Router.transitionToChannel(last);
}

/**
 * @description Remembers each channel the user opens and opens it again when Discord reconnects after an account
 * switch or a restart. Listens to `CHANNEL_SELECT`, `LOGOUT` and `CONNECTION_OPEN`.
 */
export function listenToChannels(): void {
	flux.onAction('CHANNEL_SELECT', (event: ChannelSelect) => {
		if (switching || !event.channelId) return;

		saveLastChannel(event.channelId);
	});
	flux.onAction('LOGOUT', (event) => {
		switching = 'isSwitchingAccount' in event && event.isSwitchingAccount === true;
	});
	flux.onAction('CONNECTION_OPEN', () => {
		if (!switching && restored) return;

		switching = false;
		restored = true;
		setTimeout(openLastChannel, 500);
	});
}
