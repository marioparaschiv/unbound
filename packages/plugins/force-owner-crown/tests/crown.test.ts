import { assets } from '@unbound-app/api';
import { resetHealth } from '@unbound-plugins/shared/lifecycle/health';
import { flux, metro, startPlugin } from '@unbound-app/api/testing';
import type { UnboundAsset } from '@unbound-app/api/assets';
import { beforeEach, describe, expect, test } from 'bun:test';

import { selfTest } from '~/index';
import { platformCrownSource } from '~/crown/android/crown-source';

type Row = { message: Record<string, unknown> };

const MessageRowData = { generateMessageRowData: (message: Row['message']): Row => ({ message }) };

function row(message: Record<string, unknown>) {
	return MessageRowData.generateMessageRowData({ ...message }).message;
}

beforeEach(() => {
	resetHealth();
	Object.assign(assets, {
		getById: () => ({
			httpServerLocation: '/assets/images/native/icons',
			name: 'ic_crown_16px',
		}),
	});
	metro.register(MessageRowData);
	metro.register({ getAssetUriForEmbed: (id: number) => `embed://${id}` });
	flux.seed({
		Guild: { getGuild: (id: string) => (id === 'g1' ? { ownerId: 'owner' } : undefined) },
	});
});

describe('the owner crown', () => {
	beforeEach(() => startPlugin());

	test("gives the owner's messages the crown", () => {
		expect(row({ guildId: 'g1', authorId: 'owner' }).roleIcon).toEqual({
			source: `embed://${assets.getIdByName('ic_crown_16px')}`,
			name: 'Server Owner',
			size: 18,
			alt: 'Server Owner',
		});
	});

	test('reports the crown in its self-test once started', async () => {
		expect(selfTest()).toEqual({ ok: true, detail: '1 feature applied' });
	});

	test('leaves other members alone', () => {
		expect(row({ guildId: 'g1', authorId: 'member' }).roleIcon).toBeUndefined();
	});

	test('keeps a role icon the owner already has', () => {
		const icon = { source: 'role', name: 'Admin', size: 18, alt: 'Admin' };

		expect(row({ guildId: 'g1', authorId: 'owner', roleIcon: icon }).roleIcon).toBe(icon);
	});

	test('skips direct messages and unknown servers', () => {
		expect(row({ authorId: 'owner' }).roleIcon).toBeUndefined();
		expect(row({ guildId: 'g2', authorId: 'owner' }).roleIcon).toBeUndefined();
	});
});

describe('the Android crown source', () => {
	test("points at the APK's drawable", () => {
		expect(
			platformCrownSource({
				httpServerLocation: '/assets/images/native/icons',
				name: 'ic_crown_16px',
			} as UnboundAsset),
		).toStartWith('android.resource://');
	});

	test('falls back to the embed URI without a packager location', () => {
		expect(platformCrownSource({ name: 'ic_crown_16px' } as UnboundAsset)).toBeUndefined();
	});
});
