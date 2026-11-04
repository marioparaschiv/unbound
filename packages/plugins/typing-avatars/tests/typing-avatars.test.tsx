import { metro, render, startPlugin } from '@unbound-app/api/testing';
import { resetHealth } from '@unbound-plugins/shared/lifecycle/health';
import { beforeEach, describe, expect, test } from 'bun:test';

import { selfTest } from '~/index';
import type { ReactNode } from 'react';
import { Text } from 'react-native';

import type { StoreSeeds } from '@unbound-app/api/testing';

type IndicatorProps = {
	item: { typingUserIds: string[]; channel: { guild_id: string } };
	renderItem: () => ReactNode;
};

type AvatarProps = { user: { id: string }; guildId?: string };

function Avatar({ user, guildId }: AvatarProps) {
	return <Text>{`${user.id}@${guildId}`}</Text>;
}

function Row(props: IndicatorProps) {
	return props.renderItem();
}

const indicator = {
	default: (props: IndicatorProps) => <Row {...props} />,
};

const cached = new Set(['a', 'b', 'c', 'd']);

const stores: StoreSeeds = {
	User: { getUser: (id: string) => (cached.has(id) ? { id } : undefined) },
};

function renderIndicator(typingUserIds: string[]) {
	return render(
		<indicator.default
			item={{ typingUserIds, channel: { guild_id: 'g1' } }}
			renderItem={() => <Text>typing</Text>}
		/>,
		{ stores },
	);
}

beforeEach(async () => {
	resetHealth();
	metro.register({ SummarizedIconRow: {}, Avatar, AvatarSizes: { SIZE_16: 'SIZE_16' } });
	metro.register(indicator, 'modules/chat/native/TypingIndicator.tsx');
	await startPlugin();
});

describe('the typing indicator', () => {
	test('shows the cached typing users in front of the row', () => {
		expect(renderIndicator(['a', 'x', 'b']).text()).toBe('a@g1b@g1typing');
	});

	test('shows at most three avatars', () => {
		expect(renderIndicator(['a', 'b', 'c', 'd']).text()).toBe('a@g1b@g1c@g1typing');
	});

	test('stays as Discord drew it when no typing user is cached', () => {
		expect(renderIndicator(['x', 'y']).text()).toBe('typing');
	});

	test('reports the typing indicator patch as applied', async () => {
		expect((await selfTest()).ok).toBe(true);
	});
});
