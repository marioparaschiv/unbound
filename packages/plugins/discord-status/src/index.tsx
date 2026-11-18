import { Linking } from 'react-native';
import { toasts } from '@unbound-app/api';
import { format, messages } from '@unbound-app/i18n';
import { settings } from '@unbound-app/settings';

import {
	isSummary,
	newIncidents,
	readIncidents,
	rememberAnnounced,
	type Incident,
} from '~/lib/incidents';

const SUMMARY_URL = 'https://discordstatus.com/api/v2/summary.json';
const CHECK_INTERVAL_MS = 5 * 60_000;
const FIRST_CHECK_MS = 15_000;

let timers: ReturnType<typeof setTimeout>[] = [];

function announced(): string[] {
	return settings.announced ? settings.announced.split(',') : [];
}

function announce(incident: Incident) {
	toasts.show({
		id: `discord-status-${incident.id}`,
		title: messages.OUTAGE_TITLE,
		content: format('OUTAGE_BODY', { name: incident.name, status: incident.status }),
		icon: 'GlobeEarthIcon',
		duration: 15_000,
		buttons: [
			{
				content: messages.OUTAGE_DETAILS,
				variant: 'secondary',
				onPress: () => void Linking.openURL(incident.shortlink).catch(() => undefined),
			},
		],
	});
}

async function check() {
	try {
		const response = await fetch(SUMMARY_URL);

		if (!response.ok) return;

		const payload: unknown = await response.json();
		const incidents = isSummary(payload)
			? newIncidents(readIncidents(payload), announced(), settings.minor)
			: [];

		if (!incidents.length) return;

		incidents.forEach(announce);
		settings.announced = rememberAnnounced(announced(), incidents).join(',');
	} catch (error) {
		logger.warn('Failed to check discordstatus.com:', error);
	}
}

export function start() {
	timers = [
		setTimeout(() => void check(), FIRST_CHECK_MS),
		setInterval(() => void check(), CHECK_INTERVAL_MS),
	];
}

export function stop() {
	for (const timer of timers) clearTimeout(timer);

	timers = [];
}
