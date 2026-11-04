import { metro, startPlugin } from '@unbound-app/api/testing';
import { settings } from '@unbound-app/settings';
import { describe, expect, test } from 'bun:test';

const DISCORD_LAYOUT = 2;
const DISCORD_SORT_ORDER = 1;

class ChannelRecordBase {
	media = false;

	isMediaChannel() {
		return this.media;
	}

	isGameInvitesChannel() {
		return false;
	}

	getDefaultLayout() {
		return DISCORD_LAYOUT;
	}

	getDefaultSortOrder() {
		return DISCORD_SORT_ORDER;
	}
}

function registerChannelRecord() {
	metro.register({ ChannelRecordBase }, 'records/ChannelRecord.tsx');
}

describe('forum defaults', () => {
	test('reports the picked layout and sort order for a forum', async () => {
		registerChannelRecord();
		settings.defaultLayout = 'gallery';
		settings.defaultSortOrder = 'datePosted';
		await startPlugin();

		const forum = new ChannelRecordBase();

		expect(forum.getDefaultLayout()).toBe(2);
		expect(forum.getDefaultSortOrder()).toBe(1);
	});

	test('follows a setting changed while the plugin runs', async () => {
		registerChannelRecord();
		await startPlugin();

		const forum = new ChannelRecordBase();

		expect(forum.getDefaultLayout()).toBe(1);

		settings.defaultLayout = 'gallery';

		expect(forum.getDefaultLayout()).toBe(2);
	});

	test('keeps the gallery in a media channel', async () => {
		registerChannelRecord();
		settings.defaultLayout = 'list';
		await startPlugin();

		const media = new ChannelRecordBase();

		media.media = true;

		expect(media.getDefaultLayout()).toBe(DISCORD_LAYOUT);
	});

	test('applies once Discord loads the module', async () => {
		await startPlugin();
		registerChannelRecord();

		expect(new ChannelRecordBase().getDefaultLayout()).toBe(1);
	});
});
