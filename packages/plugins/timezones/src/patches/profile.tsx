import { settings, useSetting } from '@unbound-app/settings';
import { patchAboutCard } from '@unbound-plugins/shared/profile/patch-about-card';
import { AboutSection } from '@unbound-plugins/shared/profile/about-section';
import { dialogs, flux } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';
import { useEffect, useState } from 'react';

import TimezoneEditor from '~/components/timezone-editor';
import { showsFor, timezoneOf } from '~/lib/timezone';
import {
	readChosen,
	timeIn,
	twelveHour,
	withChosen,
	type Clock,
	type SeenClock,
} from '~/lib/zones';

const TICK_MS = 30_000;

type UserStore = { getUser(id: string): { bot?: boolean } | undefined };

function editTimezone(userId: string): void {
	dialogs.showDialog({
		title: messages.SET_TIMEZONE,
		body: messages.SET_TIMEZONE_BODY,
		content: ({ dismiss }) => (
			<TimezoneEditor
				initialValue={readChosen(settings.chosen).get(userId) ?? timezoneOf(userId) ?? ''}
				onClose={dismiss}
				onSave={(zone) => {
					settings.chosen = withChosen(settings.chosen, userId, zone);
					flux.getStore('Message').emitChange?.();
				}}
			/>
		),
	});
}

function useNow(): Date {
	const [now, setNow] = useState(() => new Date());

	useEffect(() => {
		const timer = setInterval(() => setNow(new Date()), TICK_MS);

		return () => clearInterval(timer);
	}, []);

	return now;
}

function LocalTime({ userId }: { userId: string }) {
	const now = useNow();

	useSetting('chosen');
	useSetting('clock');
	useSetting('discordClock');

	const zone = timezoneOf(userId);
	const time = zone
		? `${timeIn(now, zone, twelveHour(settings.clock as Clock, settings.discordClock as SeenClock))} · ${zone}`
		: undefined;

	return (
		<AboutSection
			title={messages.LOCAL_TIME_TITLE}
			icon='ClockIcon'
			link={!time}
			onPress={() => editTimezone(userId)}
			accessibilityHint={messages.SET_TIMEZONE}
		>
			{time ?? messages.SET_TIMEZONE}
		</AboutSection>
	);
}

/**
 * @description Adds a Local Time section to a user's About card; tapping it sets their timezone by hand.
 */
export function patchProfileTime(): void {
	const Users = flux.getStore('User') as unknown as UserStore;
	const found = patchAboutCard({
		key: 'timezones-local-time',
		render({ userId }) {
			const user = Users.getUser(userId);

			if (!settings.profiles || user?.bot || !showsFor(userId)) return;

			return <LocalTime userId={userId} />;
		},
	});

	if (!found) logger.warn('Profile time skipped: Discord moved UserProfileAboutMeCard.');
}

export default { patchProfileTime };
