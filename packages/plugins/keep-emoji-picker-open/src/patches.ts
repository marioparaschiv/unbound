import { metro, patcher } from '@unbound-app/api';

import { createPickerHold, PICKER_KEY } from '~/lib/picker-hold';

const HOLD_MS = 600;

type OnPressEmoji = (...args: unknown[]) => unknown;
type PickerProps = { messageId?: string; onPressEmoji?: OnPressEmoji };
type ReactionPickerProps = PickerProps & { messageId: string; onPressEmoji: OnPressEmoji };

function isReactionPicker(
	key: unknown,
	props: PickerProps | undefined,
): props is ReactionPickerProps {
	return (
		key === PICKER_KEY && typeof props?.messageId === 'string' && Boolean(props.onPressEmoji)
	);
}

/**
 * @description Keeps the reaction emoji picker open after each pick, so several reactions go on in one visit.
 */
export function patchPicker(): void {
	const { ActionSheets } = metro.api;

	if (!ActionSheets) {
		logger.warn('Keep Emoji Picker Open skipped: Discord moved ActionSheets.');

		return;
	}

	const pickerHold = createPickerHold(HOLD_MS);

	patcher.before(ActionSheets, 'openLazy', ({ args }) => {
		const [sheet, key, props, ...rest] = args as [
			unknown,
			unknown,
			PickerProps | undefined,
			...unknown[],
		];

		if (!isReactionPicker(key, props)) return;

		const pick = props.onPressEmoji;

		return [
			sheet,
			key,
			{
				...props,
				onPressEmoji: (...pickArgs: unknown[]) => {
					pickerHold.hold();

					return pick(...pickArgs);
				},
			},
			...rest,
		];
	});

	patcher.instead(ActionSheets, 'hideActionSheet', ({ args, original, this: self }) => {
		const [key] = args as [string | undefined];

		if (pickerHold.holds(key)) return;

		return original.apply(self, args);
	});
}
