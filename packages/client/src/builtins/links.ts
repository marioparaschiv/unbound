import type { UnboundLink } from '@unbound-app/contracts/links';
import { parseUnboundLink } from '@unbound-app/contracts/links';
import type { ManagerKind } from '@unbound-app/types/addons';
import { createLogger } from '@unbound-app/logger';

import ShareDestinationSheet, { type ShareDestination } from '~/ui/share/share-destination-sheet';
import { getInstalledVersion, MARKETPLACE_TABS } from '~/ui/marketplace/targets';
import { findByPropsLazy, findStoreLazy } from '~/api/metro/wrappers';
import { navigationReady } from '~/lib/navigation-ready';
import { ActionSheets, Linking } from '~/api/metro/api';
import { getNativeModule } from '~/api/native-runtime';
import MarketplaceStore from '~/stores/marketplace';
import { Messages, format } from '~/api/i18n';
import { Screens } from '~/lib/constants';
import { showToast } from '~/api/toasts';
import fs from '~/api/fs';

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

const Logger = createLogger('Links');
const DeepLinkManager: DeepLinkManagerType | undefined = getNativeModule('DeepLinkManager');
const ShareLogger = createLogger('Share');
const SHEET_KEY = 'unbound-share-destinations';
const MAX_DESTINATIONS = 12;
const MAX_RECENT_DMS = 8;
const DRAFT_CHANNEL_MESSAGE = 0;
const UPLOAD_PLATFORM_REACT_NATIVE = 0;

const Uploads = findByPropsLazy('addFiles', 'popFirstFile');
const Router = findByPropsLazy('transitionToGuild');
const Constants = findByPropsLazy('Permissions', 'ChannelTypes');
const GuildStore = findByPropsLazy('getGuild', 'getGuilds');
const ChannelStore = findStoreLazy('Channel');
const SelectedChannelStore = findStoreLazy('SelectedChannel');
const PrivateChannelSortStore = findStoreLazy('PrivateChannelSort');
const FrecencyStore = findStoreLazy('Frecency');
const PermissionStore = findStoreLazy('Permission');
const UserStore = findStoreLazy('User');

let subscription: LinkSubscription | undefined;
let handling = false;
let sharing = false;

function isPrivate(channel: ChannelRecord): boolean {
	const { DM, GROUP_DM } = Constants.ChannelTypes;

	return channel.type === DM || channel.type === GROUP_DM;
}

function acceptsFiles(channel: ChannelRecord): boolean {
	const { GUILD_TEXT, GUILD_ANNOUNCEMENT, PUBLIC_THREAD, PRIVATE_THREAD, ANNOUNCEMENT_THREAD } =
		Constants.ChannelTypes;

	if (isPrivate(channel)) {
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

	const { SEND_MESSAGES, ATTACH_FILES } = Constants.Permissions;

	return Boolean(
		PermissionStore.can(SEND_MESSAGES, channel) && PermissionStore.can(ATTACH_FILES, channel),
	);
}

function describe(channel: ChannelRecord): ShareDestination {
	if (isPrivate(channel)) {
		const recipient: UserRecord | undefined = channel.recipients?.[0]
			? UserStore.getUser(channel.recipients[0])
			: undefined;
		const name = channel.name || recipient?.globalName || recipient?.username || channel.id;

		return {
			channelId: channel.id,
			guildId: '@me',
			label: name,
			subLabel: Messages.UNBOUND_SHARE_DIRECT_MESSAGE,
		};
	}

	const guild: GuildRecord | undefined = channel.guild_id
		? GuildStore.getGuild(channel.guild_id)
		: undefined;

	return {
		channelId: channel.id,
		guildId: channel.guild_id ?? '@me',
		label: `#${channel.name ?? channel.id}`,
		subLabel: guild?.name ?? '',
	};
}

function destinations(): ShareDestination[] {
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

		if (acceptsFiles(channel)) {
			found.push(describe(channel));
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
	showToast({
		title: Messages.UNBOUND_SHARE_TITLE,
		content: format('UNBOUND_SHARE_ADDED', {
			count: files.length,
			destination: destination.label,
		}),
		icon: 'CircleCheckIcon',
	});
}

function failed(content: string) {
	showToast({ title: Messages.UNBOUND_SHARE_TITLE, content, icon: 'CircleXIcon' });
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
			failed(Messages.UNBOUND_SHARE_UNREADABLE);

			return;
		}

		if (usable.length < files.length) {
			ShareLogger.warn(
				`Discord cannot read ${files.length - usable.length} of the shared files.`,
			);
		}

		const choices = destinations();

		if (choices.length === 0) {
			failed(Messages.UNBOUND_SHARE_NO_DESTINATIONS);

			return;
		}

		ActionSheets.openLazy(Promise.resolve({ default: ShareDestinationSheet }), SHEET_KEY, {
			destinations: choices,
			count: usable.length,
			onSelect: (destination: ShareDestination) => {
				ActionSheets.hideActionSheet(SHEET_KEY);
				stage(destination, usable).catch((error) => {
					ShareLogger.error('Failed to attach the shared files:', error);
					failed(Messages.UNBOUND_SHARE_FAILED);
				});
			},
		});
	} catch (error) {
		ShareLogger.error('Failed to receive shared files:', error);
		failed(Messages.UNBOUND_SHARE_FAILED);
	} finally {
		sharing = false;
	}
}

async function open(kind: ManagerKind, id: string) {
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
	kindOf: (type) => MARKETPLACE_TABS.find((tab) => tab.type === type)?.kind,
	installedVersion: getInstalledVersion,
	open,
};

function report(outcome: LinkOutcome) {
	switch (outcome.type) {
		case 'opened':
			return;
		case 'current':
			showToast({
				title: Messages.UNBOUND_MARKETPLACE,
				content: format('UNBOUND_LINK_ALREADY_INSTALLED', {
					name: outcome.addon.latestVersion.manifest.name,
				}),
				icon: 'CircleCheckIcon',
			});

			return;
		case 'missing':
			showToast({
				title: Messages.UNBOUND_MARKETPLACE,
				content: format('UNBOUND_LINK_NOT_FOUND', { id: outcome.id }),
				icon: 'CircleXIcon',
			});

			return;
		case 'offline':
			showToast({
				title: Messages.UNBOUND_MARKETPLACE,
				content: format('UNBOUND_LINK_OFFLINE', { id: outcome.id }),
				icon: 'CircleXIcon',
			});
	}
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

function onURL(event: LinkEvent) {
	const shared = parseShareLink(event.url);

	if (shared) {
		void receiveShare(shared);

		return;
	}

	const link = parseUnboundLink(event.url);

	if (link) {
		void receive(link);
	}
}

// Discord's scene-based iOS app hands the launch URL to its own DeepLinkManager; RN Linking reads null there.
async function readLaunchURL(): Promise<string | null> {
	const deepLink = await DeepLinkManager?.getInitialURL();

	return deepLink?.url ?? Linking.getInitialURL();
}

function claimLaunchURL(subject: string): boolean {
	if (globalThis.NativePlatform?.app.claimLaunchURL?.() ?? true) {
		return true;
	}

	Logger.info(`The launch link for ${subject} was handled before this reload.`);

	return false;
}

function onLaunchURL(url: string | null) {
	const shared = url ? parseShareLink(url) : undefined;

	if (shared) {
		if (claimLaunchURL('shared files')) {
			void receiveShare(shared);
		}

		return;
	}

	const link = url ? parseUnboundLink(url) : undefined;

	if (link && claimLaunchURL(link.id)) {
		void receive(link);
	}
}

/** Hands Unbound links to the Marketplace and shared files to a destination picker: the launch URL once per process, then every link opened while running. */
export function start() {
	subscription = Linking.addEventListener('url', onURL);
	readLaunchURL()
		.then(onLaunchURL)
		.catch((error: Error) => Logger.error('Failed to read the launch URL:', error));
}

/** Stops listening for links. */
export function stop() {
	subscription?.remove();
	subscription = undefined;
}

export default { start, stop };
