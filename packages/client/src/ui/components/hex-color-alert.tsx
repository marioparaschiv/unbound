import type { ColorPickerOptions } from '@unbound-app/types/color-picker';
import { useState } from 'react';

import { intToHex, parseColor } from '~/lib/theme-draft';
import { Discord } from '~/api/metro/components';
import { format } from '~/api/i18n';

type HexColorAlertProps = ColorPickerOptions & {
	onClose: () => void;
};

/**
 * @description Unbound's stand-in for Discord's colour picker sheet: an alert that takes a hex colour.
 * @param props The starting colour, the confirm callback and the close callback.
 * @returns The alert.
 */
function HexColorAlert({ color, onSelect, onClose }: HexColorAlertProps) {
	const [value, setValue] = useState(intToHex(color));
	const parsed = parseColor(value);

	function confirm() {
		if (!parsed) return;

		onSelect(parsed.rgb);
		onClose();
	}

	return (
		<Discord.AlertModal
			title={format('UNBOUND_PICK_COLOR')}
			content={format('UNBOUND_PICK_COLOR_HINT')}
			extraContent={
				<Discord.TextField
					value={value}
					placeholder='#rrggbb'
					autoFocus
					status={parsed ? 'default' : 'error'}
					onChange={setValue}
				/>
			}
			actions={
				<>
					<Discord.AlertActionButton
						text={format('UNBOUND_SAVE')}
						variant='primary'
						disabled={!parsed}
						onPress={confirm}
					/>
					<Discord.AlertActionButton
						text={format('UNBOUND_CANCEL')}
						variant='secondary'
						onPress={onClose}
					/>
				</>
			}
		/>
	);
}

export default HexColorAlert;
