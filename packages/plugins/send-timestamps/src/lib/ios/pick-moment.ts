import { messages } from '@unbound-app/i18n';

import { openDateSheet } from '~/lib/date-sheet';

/**
 * @description Picks a date and time on one wheel.
 * @param start The moment the picker starts on.
 * @param onPicked Gets the picked moment.
 */
export function pickMoment(start: Date, onPicked: (moment: Date) => void): void {
	openDateSheet('datetime', messages.PICKER_TITLE, start, onPicked);
}

export default pickMoment;
