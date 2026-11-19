import type { PluginContext } from '@unbound-app/api/native';
import { Linking } from 'react-native';
import { getActionSheetRow } from '@unbound-plugins/shared/action-sheets/action-sheet-row';
import patchLazySheets from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { isActionSheetRowGroup } from '@unbound-plugins/shared/action-sheets/row-group';
import { findElement } from '@unbound-plugins/shared/react/find-element';
import { assets, dialogs, metro, patcher, toasts } from '@unbound-app/api';
import { format, messages } from '@unbound-app/i18n';

import { registerEvent } from '~/commands';
import { calendarUrls, type Attachment } from '~/lib/calendar-attachments';
import { parseCalendar, type CalendarEvent } from '~/lib/ics';

type SheetProps = { message?: { attachments?: Attachment[] } };

function when({ start, end, allDay }: CalendarEvent): string {
	if (!start) return '';

	if (allDay) return format('ALL_DAY', { date: start.toLocaleDateString() });

	const ends = end ? ` – ${end.toLocaleString()}` : '';

	return `${start.toLocaleString()}${ends}`;
}

async function showEvents(url: string) {
	try {
		const response = await fetch(url);
		const events = response.ok ? parseCalendar(await response.text()) : [];

		const [event] = events;

		if (!event) {
			toasts.show({ id: 'calendar-files', title: messages.NO_EVENTS });

			return;
		}

		const more = events.length - 1;
		const add = await dialogs.confirm('EVENT_HEADING', {
			titleVars: { summary: event.summary || url.split('/').pop() || '' },
			body: 'EVENT_BODY',
			bodyVars: {
				when: when(event),
				location: event.location ? format('AT_LOCATION', { location: event.location }) : '',
				description: [
					event.description ? `\n\n${event.description}` : '',
					more > 0 ? `\n\n${format('MORE_EVENTS', { count: more })}` : '',
				].join(''),
			},
			confirm: 'ADD_TO_CALENDAR',
			cancel: 'CLOSE',
		});

		if (add) await Linking.openURL(url);
	} catch (error) {
		toasts.show({ id: 'calendar-files', title: messages.LOAD_FAILED, content: String(error) });
	}
}

export function start(context: PluginContext) {
	registerEvent(context);

	const { ActionSheets } = metro.api;

	if (!ActionSheets) {
		logger.warn('Calendar Files skipped its menu row: Discord moved ActionSheets.');

		return;
	}

	let urls: string[] = [];
	let sheetKey: string | undefined;

	// UNKNOWN: an action sheet may render any node.
	function addEventRow(result: unknown) {
		const rows = findElement(result, isActionSheetRowGroup)?.props?.children;
		const [url] = urls;

		if (!url || !Array.isArray(rows) || rows.some((row) => row?.key === 'unbound-calendar')) {
			return result;
		}

		const ActionSheetRow = getActionSheetRow();
		const icon = assets.getIdByName('CalendarIcon');

		rows.splice(
			1,
			0,
			<ActionSheetRow
				key='unbound-calendar'
				label={messages.SHOW_EVENT}
				icon={icon ? <ActionSheetRow.Icon source={icon} /> : undefined}
				onPress={() => {
					if (sheetKey) ActionSheets.hideActionSheet(sheetKey);

					void showEvents(url);
				}}
			/>,
		);

		return result;
	}

	patchLazySheets<SheetProps>(patcher, ActionSheets, (key, props) => {
		if (!key.endsWith('MessageLongPressActionSheet')) return;

		urls = calendarUrls(props.message?.attachments);
		sheetKey = key;

		return addEventRow;
	});
}

export function stop() {}
