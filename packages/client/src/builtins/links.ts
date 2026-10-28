import type { UnboundLink } from '@unbound-app/contracts/links';
import { parseUnboundLink } from '@unbound-app/contracts/links';
import { createLogger } from '@unbound-app/logger';

import { getInstalledVersion, MARKETPLACE_TABS } from '~/ui/marketplace/targets';
import { findByPropsLazy } from '~/api/metro/wrappers';
import { getNativeModule } from '~/api/native-runtime';
import MarketplaceStore from '~/stores/marketplace';
import type { ManagerKind } from '~/lib/constants';
import { Messages, format } from '~/api/i18n';
import { Linking } from '~/api/metro/api';
import { Screens } from '~/lib/constants';
import { showToast } from '~/api/toasts';

import type { LinkOutcome, LinkTargets } from './resolve-unbound-link';

import resolveUnboundLink from './resolve-unbound-link';

type LinkEvent = { url: string };
type LinkSubscription = { remove: () => void };
type InitialDeepLink = { url: string | null; isDeferred: boolean };
type DeepLinkManagerType = { getInitialURL: () => Promise<InitialDeepLink | null> };

const Logger = createLogger('Links');
const Navigation = findByPropsLazy('getRootNavigationRef');
const DeepLinkManager: DeepLinkManagerType | undefined = getNativeModule('DeepLinkManager');

const NAVIGATION_TIMEOUT_MS = 30_000;
const NAVIGATION_POLL_MS = 100;

let subscription: LinkSubscription | undefined;
let handling = false;

async function open(kind: ManagerKind, id: string) {
	const ref = Navigation.getRootNavigationRef();

	for (let waited = 0; !ref.isReady(); waited += NAVIGATION_POLL_MS) {
		if (waited >= NAVIGATION_TIMEOUT_MS) {
			throw new Error('Discord navigation never became ready.');
		}

		await new Promise((resolve) => setTimeout(resolve, NAVIGATION_POLL_MS));
	}

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

function onLaunchURL(url: string | null) {
	const link = url ? parseUnboundLink(url) : undefined;

	if (!link) return;

	if (!(globalThis.NativePlatform?.app.claimLaunchURL?.() ?? true)) {
		Logger.info(`The launch link for ${link.id} was handled before this reload.`);

		return;
	}

	void receive(link);
}

/** Hands Unbound links to the Marketplace: the launch URL once per process, then every link opened while running. */
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
