import type { UnboundLink } from '@unbound-app/contracts/links';
import { parseUnboundLink } from '@unbound-app/contracts/links';
import type { AddonKind } from '@unbound-app/types/addons';
import { createLogger } from '@unbound-app/logger';

import { navigationReady } from '~/core/navigation-ready';
import { findByProps } from '~/metro/lookups';
import { createPatcher } from '~/patcher/create-patcher';
import { Linking } from '~/metro/api';
import MarketplaceStore from '~/marketplace/state';
import { getNativeModule } from '~/native/runtime';
import { messages, format } from '~/i18n/api';
import { Manager } from '~/addons/manager';
import { Screens } from '~/core/constants';
import { show } from '~/toasts/api';

import type { LinkOutcome, LinkTargets } from './resolve-unbound-link';

import resolveUnboundLink from './resolve-unbound-link';

type LinkEvent = { url: string };
type LinkSubscription = { remove: () => void };
type InitialDeepLink = { url: string | null; isDeferred: boolean };
type DeepLinkManagerType = { getInitialURL: () => Promise<InitialDeepLink | null> };

/** The part of Discord's link click options a patch reads. */
type LinkClick = { href?: string };

const Logger = createLogger('Links');
const Patcher = createPatcher('unbound::links');
const DeepLinkManager: DeepLinkManagerType | undefined = getNativeModule('DeepLinkManager');
// Discord's one entry for tapped links (messages, embeds, buttons): it shows the leaving-Discord prompt, then opens the URL.
const LinkClicks = findByProps('handleClick', 'isLinkTrusted');

let subscription: LinkSubscription | undefined;
let handling = false;

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

/** Hands Unbound links to the Marketplace: the launch URL once per process, every link opened while running, and install links tapped in Discord. */
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
