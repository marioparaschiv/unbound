import { render, startPlugin, toasts } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';

import {
	cleared,
	MediaKeyboardActions,
	registerDiscord,
	sent,
	type OverflowButtons,
} from './fake-discord';

import type { StoreSeeds } from '@unbound-app/api/testing';

const activity = { party: { id: 'spotify:1' } };

function stores(playing: boolean, connected = true): StoreSeeds {
	return {
		Spotify: {
			getActivity: () => (playing ? activity : null),
			hasConnectedAccount: () => connected,
		},
		SelectedChannel: { getChannelId: () => 'channel' },
		Draft: { getDraft: () => 'listen with me' },
	};
}

async function renderMenu(seeds: StoreSeeds) {
	const overflowButtons: OverflowButtons = [{ text: 'Photos', onPress: () => undefined }];

	await startPlugin();

	return render(<MediaKeyboardActions overflowButtons={overflowButtons} />, { stores: seeds });
}

beforeEach(registerDiscord);

describe('Spotify invite button', () => {
	test('joins the attachment menu while an account is connected', async () => {
		const menu = await renderMenu(stores(true));

		expect(menu.findAll('Text').map((node) => node.text())).toEqual(['Photos', 'Spotify']);
	});

	test('stays out of the menu without a connected account', async () => {
		const menu = await renderMenu(stores(true, false));

		expect(menu.findAll('Text').map((node) => node.text())).toEqual(['Photos']);
	});

	test('sends the invite with your draft, then clears the draft', async () => {
		const menu = await renderMenu(stores(true));

		menu.act(() =>
			menu.find((node) => node.props.accessibilityLabel === 'Spotify').props.onPress?.(),
		);

		expect(sent).toMatchObject([
			[
				'channel',
				{ content: 'listen with me' },
				true,
				{ activityAction: { activity, type: 3 } },
			],
		]);
		expect(cleared).toEqual([['channel', 0]]);
	});

	test('asks you to play something first when nothing plays', async () => {
		const menu = await renderMenu(stores(false));

		menu.act(() =>
			menu.find((node) => node.props.accessibilityLabel === 'Spotify').props.onPress?.(),
		);

		expect(toasts.shown).toMatchObject([{ content: 'Play something on Spotify first.' }]);
		expect(sent).toEqual([]);
	});
});
