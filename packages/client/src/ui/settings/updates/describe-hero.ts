import type { UpdatesState } from '~/updates/state';
import { messages, format } from '~/i18n/api';
import { Moment } from '~/metro/common';

/** How the status card colours its badge. */
export type HeroTone = 'positive' | 'warning' | 'brand' | 'critical' | 'neutral';

export type Hero = {
	tone: HeroTone;
	/** The asset name of the badge's icon. */
	icon: string;
	title: string;
	subtitle: string;
};

/**
 * @description Words the last update check for the status card at the top of the page.
 * @param state The last check.
 * @param pending How many updates are waiting, counting the loader only while its updates run.
 * @param blocked Whether client updates run but the newest client needs a newer loader.
 * @returns The card's tone, icon, title and subtitle.
 */
export function describeHero(state: UpdatesState, pending: number, blocked: boolean): Hero {
	switch (state.status) {
		case 'idle':
			return {
				tone: 'neutral',
				icon: 'RetryIcon',
				title: messages.UNBOUND_UPDATES,
				subtitle: messages.UNBOUND_UPDATES_NOT_CHECKED,
			};
		case 'checking':
			return {
				tone: 'neutral',
				icon: 'RetryIcon',
				title: messages.UNBOUND_UPDATES_CHECKING,
				subtitle: messages.UNBOUND_UPDATES_NOT_CHECKED,
			};
		case 'error':
			return {
				tone: 'critical',
				icon: 'WarningIcon',
				title: messages.UNBOUND_UPDATES_STATUS_FAILED,
				subtitle: state.error,
			};
		case 'ready':
			break;
	}

	const subtitle = format('UNBOUND_UPDATES_CHECKED', {
		date: Moment.utc(state.checkedAt).fromNow(),
	});

	if (pending > 0) {
		return {
			tone: 'brand',
			icon: 'DownloadIcon',
			title: format('UNBOUND_UPDATES_NOTIFY_TITLE', { count: pending }),
			subtitle,
		};
	}

	return {
		tone: blocked ? 'warning' : 'positive',
		icon: blocked ? 'WarningIcon' : 'CircleCheckIcon',
		title: messages.UNBOUND_UPDATES_STATUS_UP_TO_DATE,
		subtitle,
	};
}
