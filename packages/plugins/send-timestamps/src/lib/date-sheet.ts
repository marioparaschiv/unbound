import { metro } from '@unbound-app/api';

const DATE_PICKER = 'components_native/DatePickerActionSheet.tsx';
const DATE_SHEET_KEY = 'unbound-send-timestamps';

type PickedMoment = { valueOf(): number };

export type PickerMode = 'date' | 'time' | 'datetime';

function toMinute(picked: PickedMoment): Date {
	const moment = new Date(picked.valueOf());

	moment.setSeconds(0, 0);

	return moment;
}

/**
 * @description Opens Discord's date picker sheet, each mode under its own key so one can open as another closes.
 * @param mode Whether it picks a date, a time or both.
 * @param title The sheet's title.
 * @param start The moment it starts on.
 * @param onPicked Gets the picked moment, to the minute.
 */
export function openDateSheet(
	mode: PickerMode,
	title: string,
	start: Date,
	onPicked: (moment: Date) => void,
): void {
	const DatePicker = metro.findByFilePath(DATE_PICKER)?.default;

	if (!DatePicker) {
		logger.warn('Failed to open the timestamp picker: Discord moved DatePickerActionSheet.');

		return;
	}

	metro.api.ActionSheets.openLazy(
		Promise.resolve({ default: DatePicker }),
		`${DATE_SHEET_KEY}-${mode}`,
		{
			title,
			startDate: start,
			mode,
			onSubmit: (picked: PickedMoment) => onPicked(toMinute(picked)),
		},
	);
}
