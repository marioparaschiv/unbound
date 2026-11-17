import { openSheet } from '@unbound-plugins/shared/action-sheets/open-sheet';
import { Discord } from '@unbound-app/api/metro/components';
import { settings, useSetting } from '@unbound-app/settings';
import { messages } from '@unbound-app/i18n';
import { fonts, ui } from '@unbound-app/api';
import { ScrollView } from 'react-native';

import { familyFaces, parseChoices, type ScriptChoices } from '~/lib/choices';
import { SCRIPTS, type ScriptId } from '~/lib/scripts';

const SCRIPT_NAMES: Record<ScriptId, string> = {
	latin: 'Latin',
	cyrillic: 'Кириллица',
	greek: 'Ελληνικά',
	arabic: 'العربية',
	hebrew: 'עברית',
	devanagari: 'देवनागरी',
	thai: 'ไทย',
	han: '漢字',
	kana: 'かな',
	hangeul: '한글',
};

type PickerProps = { script: ScriptId; onClose: () => void };

function save(next: ScriptChoices) {
	settings.choices = JSON.stringify(next);
}

function FacePicker({ script, onClose }: PickerProps) {
	const choices = parseChoices(useSetting('choices'));

	function pick(id: string | undefined) {
		const { [script]: _previous, ...rest } = choices;

		save(id ? { ...rest, [script]: id } : rest);
		onClose();
	}

	return (
		<Discord.ActionSheet>
			<ScrollView style={{ maxHeight: 520 }}>
				<ui.Section title={SCRIPT_NAMES[script]}>
					<ui.Row label={messages.DISCORD_FONT} onPress={() => pick(undefined)} />
					{familyFaces(fonts.getAll()).map((face) => (
						<ui.Row key={face.id} label={face.family} onPress={() => pick(face.id)} />
					))}
				</ui.Section>
			</ScrollView>
		</Discord.ActionSheet>
	);
}

function SettingsPanel() {
	const choices = parseChoices(useSetting('choices'));

	return (
		<ui.Page>
			<ui.Section title={messages.SCRIPTS} description={messages.SCRIPTS_SUBTITLE}>
				{SCRIPTS.map(({ id }) => (
					<ui.Row
						key={id}
						label={SCRIPT_NAMES[id]}
						subLabel={
							choices[id]
								? (fonts.get(choices[id])?.family ?? choices[id])
								: messages.DISCORD_FONT
						}
						onPress={() =>
							openSheet(`unbound-font-fallback-${id}`, FacePicker, { script: id })
						}
						arrow
					/>
				))}
			</ui.Section>
		</ui.Page>
	);
}

export default SettingsPanel;
