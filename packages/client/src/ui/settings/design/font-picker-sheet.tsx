import { useMemo, useState } from 'react';

import { Discord } from '~/api/metro/components';
import { ManagerKind } from '~/lib/constants';
import { getManager } from '~/managers/utils';
import { Icons } from '~/api/assets';
import { format } from '~/api/i18n';

type FontPickerSheetProps = {
	family: string;
	onClose: () => void;
};

/**
 * @description The font picker action sheet for one override target. Lists installed custom fonts,
 * system fonts, and a reset entry; selecting one writes the override through the Fonts manager.
 */
function FontPickerSheet({ family, onClose }: FontPickerSheetProps) {
	const fonts = getManager(ManagerKind.Fonts);
	const [query, setQuery] = useState('');

	const names = useMemo(() => {
		const all = [...fonts.getFonts().map((font) => font.name), ...fonts.getAvailableFonts()];
		const seen = new Set(all);
		return [...seen].filter((name) => name.toLowerCase().includes(query.toLowerCase()));
	}, [fonts, query]);

	function choose(name: string) {
		fonts.setOverride(family, name);
		onClose();
	}

	function reset() {
		fonts.clearOverride(family);
		onClose();
	}

	return (
		<Discord.ActionSheet>
			<Discord.TextField
				size='md'
				value={query}
				onChange={setQuery}
				isClearable
				isRound
				placeholder={format('UNBOUND_SEARCH', { type: format('UNBOUND_FONTS') })}
				leadingIcon={() => <Discord.TableRowIcon source={Icons.MagnifyingGlassIcon ?? 0} />}
			/>
			<Discord.ActionSheetRow label={format('UNBOUND_RESET')} onPress={reset} />
			{names.map((name) => (
				<Discord.ActionSheetRow key={name} label={name} onPress={() => choose(name)} />
			))}
		</Discord.ActionSheet>
	);
}

export default FontPickerSheet;
