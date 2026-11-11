import type { UnboundLink } from '@unbound-app/contracts/links';
import { parseUnboundLink } from '@unbound-app/contracts/links';
import type { AddonKind } from '@unbound-app/types/addons';
import { createLogger } from '@unbound-app/logger';

import type { ShareDestination } from '~/ui/share/share-destination-sheet';
import { navigationReady } from '~/core/navigation-ready';
import { findByProps, findStore } from '~/metro/lookups';
import { createPatcher } from '~/patcher/create-patcher';
import { ActionSheets, Linking } from '~/metro/api';
import MarketplaceStore from '~/marketplace/state';
import { getNativeModule } from '~/native/runtime';
import { messages, format } from '~/i18n/api';
import { Manager } from '~/addons/manager';
import { Screens } from '~/core/constants';
import { show } from '~/toasts/api';
import fs from '~/native/fs';

import type { LinkOutcome, LinkTargets } from './resolve-unbound-link';
import type { SharedFile } from './share-link';

import resolveUnboundLink from './resolve-unbound-link';
import parseShareLink from './share-link';

type LinkEvent = { url: string };
type LinkSubscription = { remove: () => void };
type InitialDeepLink = { url: string | null; isDeferred: boolean };
type DeepLinkManagerType = { getInitialURL: () => Promise<InitialDeepLink | null> };

type ChannelRecord = {
	id: string;
	type: number;
	name?: string;
	guild_id?: string | null;
	recipients?: string[];
};

type UserRecord = {
	username: string;
	globalName?: string | null;
};

type GuildRecord = {
	name: string;
};

/** The part of Discord's link click options a patch reads. */
type LinkClick = { href?: string };

const Logger = createLogger('Links');
const Patcher = createPatcher('unbound::links');
const DeepLinkManager: DeepLinkManagerType | undefined = getNativeModule('DeepLinkManager');
const ShareLogger = createLogger('Share');
const SHEET_KEY = 'unbound-share-destinations';
const MAX_DESTINATIONS = 12;
const MAX_RECENT_DMS = 8;
const DRAFT_CHANNEL_MESSAGE = 0;
const UPLOAD_PLATFORM_REACT_NATIVE = 0;

const Uploads = findByProps('addFiles', 'popFirstFile');
const Router = findByProps('transitionToGuild');
const Constants = findByProps('Permissions', 'ChannelTypes');
const GuildStore = findByProps('getGuild', 'getGuilds');
const ChannelStore = findStore('Channel');
const SelectedChannelStore = findStore('SelectedChannel');
const PrivateChannelSortStore = findStore('PrivateChannelSort');
const FrecencyStore = findStore('Frecency');
const PermissionStore = findStore('Permission');
const UserStore = findStore('User');
// Discord's one entry for tapped links (messages, embeds, buttons): it shows the leaving-Discord prompt, then opens the URL.
const LinkClicks = findByProps('handleClick', 'isLinkTrusted');

let subscription: LinkSubscription | undefined;
let handling = false;
let sharing = false;

function isPrivate(channel: ChannelRecord, constants: MetroExport): boolean {
	const { DM, GROUP_DM } = constants.ChannelTypes;

	return channel.type === DM || channel.type === GROUP_DM;
}

function acceptsFiles(channel: ChannelRecord, constants: MetroExport): boolean {
	const { GUILD_TEXT, GUILD_ANNOUNCEMENT, PUBLIC_THREAD, PRIVATE_THREAD, ANNOUNCEMENT_THREAD } =
		constants.ChannelTypes;

	if (isPrivate(channel, constants)) {
		return true;
	}

	if (
		![
			GUILD_TEXT,
			GUILD_ANNOUNCEMENT,
			PUBLIC_THREAD,
			PRIVATE_THREAD,
			ANNOUNCEMENT_THREAD,
		].includes(channel.type)
	) {
		return false;
	}

	const { SEND_MESSAGES, ATTACH_FILES } = constants.Permissions;

	return Boolean(
		PermissionStore.can(SEND_MESSAGES, channel) && PermissionStore.can(ATTACH_FILES, channel),
	);
}

function describe(
	channel: ChannelRecord,
	constants: MetroExport,
	guilds: MetroExport,
): ShareDestination {
	if (isPrivate(channel, constants)) {
		const recipient: UserRecord | undefined = channel.recipients?.[0]
			? UserStore.getUser(channel.recipients[0])
			: undefined;
		const name = channel.name || recipient?.globalName || recipient?.username || channel.id;

		return {
			channelId: channel.id,
			guildId: '@me',
			label: name,
			subLabel: messages.UNBOUND_SHARE_DIRECT_MESSAGE,
		};
	}

	const guild: GuildRecord | undefined = channel.guild_id
		? guilds.getGuild(channel.guild_id)
		: undefined;

	return {
		channelId: channel.id,
		guildId: channel.guild_id ?? '@me',
		label: `#${channel.name ?? channel.id}`,
		subLabel: guild?.name ?? '',
	};
}

function destinations(): ShareDestination[] {
	if (!Constants || !GuildStore) {
		ShareLogger.warn('Share destinations skipped: Discord moved ChannelTypes or getGuild.');

		return [];
	}

	const recent: (ChannelRecord | undefined)[] = [
		ChannelStore.getChannel(SelectedChannelStore.getChannelId()),
		...(FrecencyStore.getFrequentlyWithoutFetchingLatest() ?? []),
		...(PrivateChannelSortStore.getPrivateChannelIds() ?? [])
			.slice(0, MAX_RECENT_DMS)
			.map((id: string) => ChannelStore.getChannel(id)),
	];
	const seen = new Set<string>();
	const found: ShareDestination[] = [];

	for (const channel of recent) {
		if (!channel || typeof channel.type !== 'number' || seen.has(channel.id)) {
			continue;
		}

		seen.add(channel.id);

		if (acceptsFiles(channel, Constants)) {
			found.push(describe(channel, Constants, GuildStore));
		}

		if (found.length === MAX_DESTINATIONS) {
			break;
		}
	}

	return found;
}

async function readable(files: SharedFile[]): Promise<SharedFile[]> {
	const checks = await Promise.all(
		files.map((file) => fs.exists(file.path, false).catch(() => false)),
	);

	return files.filter((_, index) => checks[index]);
}

async function stage(destination: ShareDestination, files: SharedFile[]) {
	if (!Router || !Uploads) {
		ShareLogger.warn('Sharing skipped: Discord moved transitionToGuild or addFiles.');
		failed(messages.UNBOUND_SHARE_FAILED);

		return;
	}

	Router.transitionToGuild(destination.guildId, destination.channelId);
	Uploads.addFiles({
		channelId: destination.channelId,
		draftType: DRAFT_CHANNEL_MESSAGE,
		files: files.map(({ uri, filename, mimeType }) => ({
			platform: UPLOAD_PLATFORM_REACT_NATIVE,
			uri,
			filename,
			mimeType,
		})),
	});
	show({
		title: messages.UNBOUND_SHARE_TITLE,
		content: format('UNBOUND_SHARE_ADDED', {
			count: files.length,
			destination: destination.label,
		}),
		icon: 'CircleCheckIcon',
	});
}

function failed(content: string) {
	show({ title: messages.UNBOUND_SHARE_TITLE, content, icon: 'CircleXIcon' });
}

async function receiveShare(files: SharedFile[]) {
	if (sharing) {
		ShareLogger.warn('Dropped shared files while others are being shared.');

		return;
	}

	sharing = true;

	try {
		await navigationReady();

		const usable = await readable(files);

		if (usable.length === 0) {
			failed(messages.UNBOUND_SHARE_UNREADABLE);

			return;
		}

		if (usable.length < files.length) {
			ShareLogger.warn(
				`Discord cannot read ${files.length - usable.length} of the shared files.`,
			);
		}

		const choices = destinations();

		if (choices.length === 0) {
			failed(messages.UNBOUND_SHARE_NO_DESTINATIONS);

			return;
		}

		// Required on use, so startup never evaluates the UI.
		const { default: ShareDestinationSheet } = require('~/ui/share/share-destination-sheet');

		ActionSheets.openLazy(Promise.resolve({ default: ShareDestinationSheet }), SHEET_KEY, {
			destinations: choices,
			count: usable.length,
			onSelect: (destination: ShareDestination) => {
				ActionSheets.hideActionSheet(SHEET_KEY);
				stage(destination, usable).catch((error) => {
					ShareLogger.error('Failed to attach the shared files:', error);
					failed(messages.UNBOUND_SHARE_FAILED);
				});
			},
		});
	} catch (error) {
		ShareLogger.error('Failed to receive shared files:', error);
		failed(messages.UNBOUND_SHARE_FAILED);
	} finally {
		sharing = false;
	}
}

async function open(kind: AddonKind, id: string) {
	const ref = await navigationReady();

	ref.navigate('settings', {
		screen: Screens.Marketplace,
		params: { kind, id, request: Date.now() },
	});
}

const targets: LinkTargets = {
	load: () => MarketplaceStore.getState().load(),
	refresh: () => MarketplaceStore.getState().refresh(),
	state: () => MarketplaceStore.getState().state,
	installedVersion: (kind, listed) => Manager.for(kind).getInstalledVersion(listed),
	open,
};

function report(outcome: LinkOutcome) {
	if (outcome.type === 'opened') return;

	const current = outcome.type === 'current';
	const content = current
		? format('UNBOUND_LINK_ALREADY_INSTALLED', {
				name: outcome.addon.latestVersion.manifest.name,
			})
		: format(outcome.type === 'missing' ? 'UNBOUND_LINK_NOT_FOUND' : 'UNBOUND_LINK_OFFLINE', {
				id: outcome.id,
			});

	show({
		title: messages.UNBOUND_MARKETPLACE,
		content,
		icon: current ? 'CircleCheckIcon' : 'CircleXIcon',
	});
}

async function receive(link: UnboundLink) {
	if (handling) {
		Logger.warn(`Dropped a link for ${link.id} while another is being handled.`);

		return;
	}

	handling = true;

	try {
		report(await resolveUnboundLink(link, targets));
	} catch (error) {
		Logger.error(`Failed to handle the link for ${link.id}:`, error);
	} finally {
		handling = false;
	}
}

function handleURL(url: string, launch = false) {
	const shared = parseShareLink(url);

	if (shared) {
		if (!launch || claimLaunchURL('shared files')) {
			void receiveShare(shared);
		}

		return;
	}

	const link = parseUnboundLink(url);

	if (link && (!launch || claimLaunchURL(link.id))) {
		void receive(link);
	}
}

// Discord's scene-based iOS app hands the launch URL to its own DeepLinkManager; RN Linking reads null there.
async function readLaunchURL(): Promise<string | null> {
	const deepLink = await DeepLinkManager?.getInitialURL();

	return deepLink?.url ?? Linking.getInitialURL();
}

function claimLaunchURL(subject: string): boolean {
	if (globalThis.NativePlatform?.app.claimLaunchURL() ?? true) {
		return true;
	}

	Logger.info(`The launch link for ${subject} was handled before this reload.`);

	return false;
}

/** Hands Unbound links to the Marketplace and shared files to a destination picker: the launch URL once per process, every link opened while running, and install links tapped in Discord. */
export function start() {
	subscription = Linking.addEventListener('url', (event: LinkEvent) => handleURL(event.url));
	patchLinkClicks();
	readLaunchURL()
		.then((url: string | null) => {
			if (url) {
				handleURL(url, true);
			}
		})
		.catch((error: Error) => Logger.error('Failed to read the launch URL:', error));
}

// An install link tapped inside Discord installs in place, before any prompt or browser.
function patchLinkClicks() {
	if (!LinkClicks) {
		Logger.warn('Install links in Discord skipped: Discord moved handleClick.');

		return;
	}

	Patcher.instead(LinkClicks, 'handleClick', ({ args, original, this: self }) => {
		const [options] = args as [LinkClick | undefined];
		const link = options?.href ? parseUnboundLink(options.href) : undefined;

		if (!link) {
			return original.apply(self, args);
		}

		void receive(link);
	});
}

/** Stops listening for links. */
export function stop() {
	subscription?.remove();
	subscription = undefined;
	Patcher.unpatchAll();
}

export default { start, stop };
