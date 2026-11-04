import { assets } from '@unbound-app/api';
import { flux, metro, native, startPlugin } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';

type Row = { message: Record<string, unknown> };

const MessageRowData = { generateMessageRowData: (message: Row['message']): Row => ({ message }) };

function row(message: Record<string, unknown>) {
	return MessageRowData.generateMessageRowData({ ...message }).message;
}

beforeEach(() => {
	native.setPlatform('ios');
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

	test("uses the APK's drawable on Android", async () => {
		native.setPlatform('android');
		await startPlugin();

		const source = row({ guildId: 'g1', authorId: 'owner' }).roleIcon as { source: string };

		expect(source.source).toStartWith('android.resource://');
	});
});
