import type { UnboundLink } from '@unbound-app/contracts/links';
import { parseUnboundLink } from '@unbound-app/contracts/links';
import { createLogger } from '@unbound-app/logger';

import { getInstalledVersion, MARKETPLACE_TABS } from '~/ui/marketplace/targets';
import { navigationReady } from '~/lib/navigation-ready';
import { getNativeModule } from '~/api/native-runtime';
import MarketplaceStore from '~/stores/marketplace';
import type { ManagerKind } from '~/lib/constants';
import { Messages, format } from '~/api/i18n';
import { Linking } from '~/api/metro/api';
import { Screens } from '~/lib/constants';
import { showToast } from '~/api/toasts';

import type { LinkOutcome, LinkTargets } from './resolve-unbound-link';

import resolveUnboundLink from './resolve-unbound-link';
import parseShareLink from './share-link';
import { receiveShare } from './share';

type LinkEvent = { url: string };
type LinkSubscription = { remove: () => void };
type InitialDeepLink = { url: string | null; isDeferred: boolean };
type DeepLinkManagerType = { getInitialURL: () => Promise<InitialDeepLink | null> };

const Logger = createLogger('Links');
const DeepLinkManager: DeepLinkManagerType | undefined = getNativeModule('DeepLinkManager');

let subscription: LinkSubscription | undefined;
let handling = false;

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
