import type { ComponentProps, ReactNode } from 'react';

import { Discord } from '~/metro/components';

import TextSettingModal from './text-setting-modal';

const ALERT_KEY = 'unbound-text-setting';

type TextSettingRowProps = Omit<ComponentProps<typeof TextSettingModal>, 'title' | 'onClose'> & {
	label: string;
	icon: ReactNode;
	disabled?: boolean;
};

/**
 * @description A settings row showing a text setting's value, or its placeholder while unset. Pressing it
 * edits the value in an alert, so the page never jumps around a keyboard.
 */
function TextSettingRow({ label, icon, disabled, ...modal }: TextSettingRowProps) {
	function edit() {
		Discord.openAlert(
			ALERT_KEY,
			<TextSettingModal
				{...modal}
				title={label}
				onClose={() => Discord.dismissAlert(ALERT_KEY)}
			/>,
		);
	}

	return (
		<Discord.TableRow
			label={label}
			subLabel={modal.value || modal.placeholder}
			icon={icon}
			arrow
			disabled={disabled}
			onPress={edit}
		/>
	);
}

export default TextSettingRow;
