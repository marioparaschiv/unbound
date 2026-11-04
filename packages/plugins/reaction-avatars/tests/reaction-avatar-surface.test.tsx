import { flux as fakeFlux, metro, render } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';
import { Text } from 'react-native';

import type { StoreSeeds } from '@unbound-app/api/testing';
import type { UserSummaryItemProps } from '~/reactions/components/reaction-avatar-surface';

import ReactionAvatarSurface from '~/reactions/components/reaction-avatar-surface';
import { surfaceStates } from '~/reactions/surface-states';

function UserSummaryItem({ users }: UserSummaryItemProps) {
	return <Text>{users[0]?.username}</Text>;
}

function stores(names: Record<string, string> = {}): StoreSeeds {
	return {
		User: { getUser: (id: string) => (names[id] ? { id, username: names[id] } : undefined) },
	};
}

function show(count: number, totalCount = count) {
	surfaceStates.set('surface', {
		height: 36,
		measured: true,
		onWidth: () => {},
		totalCount,
		users: Array.from({ length: count }, (_, index) => ({
			id: String(index),
			username: `user${index}`,
		})),
		width: 40,
	});
}

beforeEach(() => {
	surfaceStates.clear();
	metro.register({ default: UserSummaryItem }, 'components_native/common/UserSummaryItem.tsx');
});

describe('the reaction avatar surface', () => {
	test('draws a face for each reactor', () => {
		show(2);

		const view = render(<ReactionAvatarSurface surfaceId='surface' />, { stores: stores() });

		expect(view.findAll('Text').map((node) => node.text())).toEqual(['user0', 'user1']);
	});

	test('collapses reactors past five into a +N badge', () => {
		show(5, 8);

		const view = render(<ReactionAvatarSurface surfaceId='surface' />, { stores: stores() });

		expect(
			view
				.findAll('Text')
				.map((node) => node.text())
				.at(-1),
		).toBe('+3');
	});

	test('shows a reactor as Discord knows them, and follows a rename', () => {
		show(1);

		const view = render(<ReactionAvatarSurface surfaceId='surface' />, {
			stores: stores({ 0: 'wumpus' }),
		});

		expect(view.text()).toBe('wumpus');

		fakeFlux.seed({ User: { getUser: () => ({ id: '0', username: 'nelly' }) } });

		expect(view.text()).toBe('nelly');
	});

	test('draws nothing for a surface that is gone', () => {
		const view = render(<ReactionAvatarSurface surfaceId='surface' />, { stores: stores() });

		expect(view.findAll('Text')).toEqual([]);
	});
});
