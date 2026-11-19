import { getActionSheetRow } from '@unbound-plugins/shared/action-sheets/action-sheet-row';
import patchLazySheets from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { isActionSheetRowGroup } from '@unbound-plugins/shared/action-sheets/row-group';
import { findElement } from '@unbound-plugins/shared/react/find-element';
import { assets, dialogs, metro, patcher, toasts } from '@unbound-app/api';
import { format, messages } from '@unbound-app/i18n';
import { Linking } from 'react-native';

import { findFlights, trackerLink, type FlightNumber } from '~/lib/flights';
import { readStatus, type Aircraft, type Status } from '~/lib/position';

type SheetProps = { message?: { content?: string } };

const LOOKUP_URL = 'https://api.adsb.lol/v2/callsign/';

function describe(status: Status): string {
	const aircraft =
		status.state !== 'unseen' && status.type
			? ` ${format('AIRCRAFT', { type: status.type, registration: status.registration ?? '?' })}`
			: '';

	if (status.state === 'unseen') return messages.NOT_FLYING;

	if (status.state === 'ground') return `${messages.ON_GROUND}${aircraft}`;

	const vertical =
		status.vertical === 'climbing'
			? ` ${messages.CLIMBING}`
			: status.vertical === 'descending'
				? ` ${messages.DESCENDING}`
				: '';

	return `${format('AIRBORNE', { altitude: status.altitude.toLocaleString(), speed: status.speed, heading: status.heading })}${vertical}${aircraft}`;
}

async function showStatus({ flight, callsign }: FlightNumber) {
	try {
		const response = await fetch(LOOKUP_URL + callsign);
		const body = response.ok ? ((await response.json()) as { ac?: Aircraft[] }) : undefined;

		if (!body) throw new Error(`adsb.lol answered ${response.status}`);

		dialogs.showDialog({
			title: flight,
			body: describe(readStatus(body.ac)),
			buttons: [
				{
					label: messages.OPEN_TRACKER,
					onPress: () =>
						void Linking.openURL(trackerLink(flight)).catch((error: unknown) =>
							logger.error(`Failed to open the tracker for flight ${flight}:`, error),
						),
				},
			],
			cancel: messages.CLOSE,
		});
	} catch (error) {
		logger.error(`Failed to look up flight ${flight}:`, error);
		toasts.show({ id: 'flight-status', title: format('LOOKUP_FAILED', { flight }) });
	}
}

export function start() {
	const { ActionSheets } = metro.api;

	if (!ActionSheets) {
		logger.warn('Flight Status skipped: Discord moved ActionSheets.');

		return;
	}

	let flights: FlightNumber[] = [];
	let sheetKey: string | undefined;

	// UNKNOWN: an action sheet may render any node.
	function addFlightRows(result: unknown) {
		const rows = findElement(result, isActionSheetRowGroup)?.props?.children;

		if (
			!flights.length ||
			!Array.isArray(rows) ||
			rows.some((row) => String(row?.key).startsWith('unbound-flight-'))
		) {
			return result;
		}

		const ActionSheetRow = getActionSheetRow();
		const icon = assets.getIdByName('GlobeEarthIcon');

		rows.splice(
			1,
			0,
			...flights.map((flight) => (
				<ActionSheetRow
					key={`unbound-flight-${flight.callsign}`}
					label={format('ROW', { flight: flight.flight })}
					icon={icon ? <ActionSheetRow.Icon source={icon} /> : undefined}
					onPress={() => {
						if (sheetKey) ActionSheets.hideActionSheet(sheetKey);

						void showStatus(flight);
					}}
				/>
			)),
		);

		return result;
	}

	patchLazySheets<SheetProps>(patcher, ActionSheets, (key, props) => {
		if (!key.endsWith('MessageLongPressActionSheet')) return;

		flights = findFlights(props.message?.content ?? '');
		sheetKey = key;

		return addFlightRows;
	});
}

export function stop() {}
