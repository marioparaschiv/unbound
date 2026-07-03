import { memo } from 'react';

import { Discord } from '~/api/metro/components';
import { useSettingsStore } from '~/api/storage';
import { ManagerKind } from '~/lib/constants';
import { getManager } from '~/managers/utils';
import { findByProps } from '~/api/metro';
import { format } from '~/api/i18n';

import FontPickerSheet from './font-picker-sheet';

type FontOverrideRowProps = {
	group: string;
	families: string[];
};

/**
 * @description One font override target row. Shows the target group and its current override (or the
 * default), and opens the picker on press. Reads its override from the Fonts manager.
 */
function FontOverrideRow({ group, families }: FontOverrideRowProps) {
	const fonts = getManager(ManagerKind.Fonts);
	useSettingsStore('unbound', ({ key }) => key === 'font-states');
	const overrides = fonts.getOverrides();
	const current =
		families.map((family) => overrides[family]).find(Boolean) ?? format('UNBOUND_DEFAULT');

	function open() {
		const family = families[0];
		const sheets = findByProps('openLazy', 'hideActionSheet');
		const key = `unbound-font-picker-${family}`;

		sheets.openLazy(Promise.resolve({ default: FontPickerSheet }), key, {
			family,
			onClose: () => sheets.hideActionSheet(key),
		});
	}

	return <Discord.TableRow label={group} subLabel={current} arrow onPress={open} />;
}

export default memo(FontOverrideRow);
