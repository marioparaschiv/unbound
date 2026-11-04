import { metro, render, startPlugin } from '@unbound-app/api/testing';
import { beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { memo } from 'react';
import { View } from 'react-native';

import type { StoreSeeds } from '@unbound-app/api/testing';

const draft = { text: '' };

const FloatingChatInputContainer = memo((_props: { channelId: string }) => <View />);

function stores(premiumType = 0): StoreSeeds {
	return {
		User: { getCurrentUser: () => ({ id: '1', premiumType }) },
		Channel: { getChannel: () => ({ id: '1' }) },
		SelectedChannel: { getChannelId: () => '1' },
	};
}

function renderComposer(options: { premiumType?: number; colorEffects?: boolean } = {}) {
	return render(<FloatingChatInputContainer channelId='1' />, {
		stores: stores(options.premiumType),
		settings: { colorEffects: options.colorEffects ?? true },
	});
}

beforeAll(() => {
	metro.register({ getBestActiveInputForChannelId: () => ({ getText: () => draft.text }) });
	metro.register(
		{ default: FloatingChatInputContainer },
		'modules/chat_input/native/FloatingChatInputContainer.tsx',
	);
	metro.register({ colors: { TEXT_NORMAL: '#f2f3f5', RED_400: '#ed4245' }, internal: {} });
});

beforeEach(async () => {
	draft.text = '';
	await startPlugin();
});

describe('the composer counter', () => {
	test('shows the length over the limit while a message is written', () => {
		draft.text = 'hello';

		const counter = renderComposer().find('Text');

		expect(counter.text()).toBe('5/2000');
		expect(counter.props.accessibilityLabel).toBe('5 of 2000 characters');
	});

	test('hides while the composer is empty', () => {
		expect(renderComposer().findAll('Text')).toEqual([]);
	});

	test('raises the limit to 4000 with Nitro', () => {
		draft.text = 'hello';

		expect(renderComposer({ premiumType: 2 }).text()).toBe('5/4000');
	});

	test('turns red at 90% of the limit, and stays in the brand color with thresholds off', () => {
		draft.text = 'a'.repeat(1800);

		expect(renderComposer().find('Text').props.style).toMatchObject({ color: '#ed4245' });
		expect(renderComposer({ colorEffects: false }).find('Text').props.style).toMatchObject({
			color: '#5865f2',
		});
	});
});
