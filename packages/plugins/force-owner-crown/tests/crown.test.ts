import { assets } from '@unbound-app/api';
import { flux, logs, metro, native, startPlugin } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';

type Row = { message: Record<string, unknown> };

const MessageRowData = { generateMessageRowData: (message: Row['message']): Row => ({ message }) };

function row(message: Record<string, unknown>) {
	return MessageRowData.generateMessageRowData({ ...message }).message;
}

beforeEach(() => {
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

	test('starts without a warning, so its self-test passes', () => {
		expect(logs.entries.filter(({ level }) => level === 'warn' || level === 'error')).toEqual(
			[],
		);
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
	beforeEach(() => native.setPlatform('android'));

	test("points at the APK's drawable", async () => {
		await startPlugin();

		expect(row({ guildId: 'g1', authorId: 'owner' }).roleIcon).toMatchObject({
			source: expect.stringMatching(/^android\.resource:\/\//),
		});
	});

	test('falls back to the embed URI without a packager location', async () => {
		Object.assign(assets, { getById: () => ({ name: 'ic_crown_16px' }) });
		await startPlugin();

		expect(row({ guildId: 'g1', authorId: 'owner' }).roleIcon).toMatchObject({
			source: `embed://${assets.getIdByName('ic_crown_16px')}`,
		});
	});
});
