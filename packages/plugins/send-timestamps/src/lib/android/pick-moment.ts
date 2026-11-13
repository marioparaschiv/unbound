import { messages } from '@unbound-app/i18n';

import { openDateSheet } from '~/lib/date-sheet';

/**
 * @description Picks a date, then a time on that date, since Android's wheel cannot show both at once.
 * @param start The moment the picker starts on.
 * @param onPicked Gets the picked moment.
 */
export function pickMoment(start: Date, onPicked: (moment: Date) => void): void {
	openDateSheet('date', messages.PICK_DATE, start, (day) =>
		openDateSheet('time', messages.PICK_TIME, day, onPicked),
	);
}

export default pickMoment;
