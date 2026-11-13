import { settings, useSetting } from '@unbound-app/settings';
import { dialogs, flux, metro, patcher } from '@unbound-app/api';
import { Discord } from '@unbound-app/api/metro/components';
import { format, messages } from '@unbound-app/i18n';
import { cloneElement, useEffect, useState, type ReactElement } from 'react';
import { Pressable } from 'react-native';

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

type PrimaryInfoProps = {
	user?: { id?: string; bot?: boolean };
};

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
	const label = zone
		? format('LOCAL_TIME_ZONE', {
				time: timeIn(
					now,
					zone,
					twelveHour(settings.clock as Clock, settings.discordClock as SeenClock),
				),
				zone,
			})
		: messages.SET_TIMEZONE;

	return (
		<Pressable
			accessibilityRole='button'
			onPress={() => editTimezone(userId)}
			style={{ marginTop: 8 }}
		>
			<Discord.Text variant='text-sm/medium' color='text-muted'>
				{`🕒 ${label}`}
			</Discord.Text>
		</Pressable>
	);
}

/**
 * @description Shows a user's local time under their name on their profile; tapping it sets their timezone by hand.
 */
export function patchProfileTime(): void {
	const UserProfilePrimaryInfo = metro.findByFilePath(
		'modules/user_profile/native/UserProfilePrimaryInfo.tsx',
	);

	if (!UserProfilePrimaryInfo) {
		logger.warn('Profile time skipped: Discord moved UserProfilePrimaryInfo.');

		return;
	}

	patcher.react.after(UserProfilePrimaryInfo, 'default', ({ props, result }) => {
		const user = (props as PrimaryInfoProps | undefined)?.user;

		if (!settings.profiles || !result || !user?.id || user.bot || !showsFor(user.id)) return;

		const time = <LocalTime key='timezones-local-time' userId={user.id} />;
		const element = result as ReactElement<{ children?: unknown }>;
		const children = element.props?.children;

		if (children === undefined) {
			return (
				<>
					{result}
					{time}
				</>
			);
		}

		return cloneElement(element, { children: [...[children].flat(), time] });
	});
}

export default { patchProfileTime };
