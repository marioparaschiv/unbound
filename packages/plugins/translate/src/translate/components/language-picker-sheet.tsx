import { getActionSheetRow } from '@unbound-plugins/shared/action-sheets/action-sheet-row';
import { openSheet } from '@unbound-plugins/shared/action-sheets/open-sheet';
import { Discord } from '@unbound-app/api/metro/components';
import { assets } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';
import { View } from 'react-native';
import { useState } from 'react';

import { languageLabel, searchLanguages } from '~/translate/languages';

type LanguagePickerOptions = {
	title: string;
	current: string;
	includeAuto?: boolean;
	onSelect: (code: string) => void;
};

type LanguagePickerSheetProps = LanguagePickerOptions & {
	onClose: () => void;
};

function LanguagePickerSheet({
	title,
	current,
	includeAuto,
	onSelect,
	onClose,
}: LanguagePickerSheetProps) {
	const [query, setQuery] = useState('');
	const ActionSheetRow = getActionSheetRow();
	const checkIcon =
		assets.getIdByName('CheckmarkLargeIcon') ??
		assets.getIdByName('CheckIcon') ??
		assets.getIdByName('CheckmarkIcon');
	const rows = searchLanguages(query, includeAuto);

	return (
		<Discord.ActionSheet>
			<Discord.Text
				variant='heading-lg/semibold'
				style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}
			>
				{title}
			</Discord.Text>
			<View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
				<Discord.TextField
					size='md'
					value={query}
					onChange={setQuery}
					isClearable
					isRound
					placeholder={messages.SEARCH_LANGUAGES}
				/>
			</View>
			<ActionSheetRow.Group>
				{rows.map((language) => (
					<ActionSheetRow
						key={language.code}
						label={languageLabel(language)}
						subLabel={language.code}
						icon={
							language.code === current && checkIcon ? (
								<ActionSheetRow.Icon source={checkIcon} />
							) : undefined
						}
						onPress={() => {
							onSelect(language.code);
							onClose();
						}}
					/>
				))}
				{rows.length ? null : (
					<ActionSheetRow label={messages.NO_MATCHES} onPress={onClose} />
				)}
			</ActionSheetRow.Group>
		</Discord.ActionSheet>
	);
}

/**
 * @description Opens the language picker as a Discord action sheet.
 * @param options The sheet's title, the selected language, whether to offer auto detect, and the selection callback.
 */
export function openLanguagePicker(options: LanguagePickerOptions): void {
	openSheet(
		`unbound-translate-${options.title}-${options.current}`,
		LanguagePickerSheet,
		options,
	);
}

export default LanguagePickerSheet;
