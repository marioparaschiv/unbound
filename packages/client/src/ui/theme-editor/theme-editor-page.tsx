import { useEffect, useMemo, useState } from 'react';
import type { Theme } from '@unbound-app/types';

import ThemeEditorStore from '~/themes/editor-state';
import ButtonRow from '~/ui/settings-kit/button-row';
import PickerRow from '~/ui/settings-kit/picker-row';
import InputRow from '~/ui/settings-kit/input-row';
import { messages, format } from '~/i18n/api';
import { Discord } from '~/metro/components';
import { Screens } from '~/core/constants';
import { themes } from '~/themes/manager';
import ThemeStore from '~/themes/state';
import Page from '~/ui/components/page';
import { show } from '~/toasts/api';

import { BASIC_CATEGORIES, availableColors } from './token-groups';
import useEditorScreen from './use-editor-screen';
import ThemeColorRow from './theme-color-row';
import ThemeFileRows from './theme-file-rows';
import EditorActions from './editor-actions';
import { tokenNames } from './token-colors';

const BASES: { value: Theme['type']; label: string }[] = [
	{ value: 'light', label: messages.UNBOUND_THEME_BASE_LIGHT },
	{ value: 'dark', label: messages.UNBOUND_THEME_BASE_DARK },
	{ value: 'darker', label: messages.UNBOUND_THEME_BASE_DARKER },
	{ value: 'midnight', label: messages.UNBOUND_THEME_BASE_MIDNIGHT },
];

function isBase(value: string): value is Theme['type'] {
	return BASES.some((base) => base.value === value);
}

/**
 * @description The theme editor: the theme's details, the curated colours by category, every Discord colour behind All
 * Colors, and the theme as a file. The draft stays drawn after leaving, until it is saved or discarded.
 */
function ThemeEditorPage() {
	const navigation = Discord.useNavigation();
	const session = ThemeEditorStore((state) => state.session);
	const draft = ThemeStore((state) => state.preview);
	const [saving, setSaving] = useState(false);
	const scroll = useEditorScreen({ screen: Screens.ThemeEditor });
	const names = useMemo(() => tokenNames(), []);
	const categories = useMemo(() => {
		const live = new Set(names);

		return BASIC_CATEGORIES.map((category) => ({
			title: messages[category.title],
			colors: availableColors(category, live),
		})).filter((category) => category.colors.length > 0);
	}, [names]);

	const edited = draft ? names.filter((name) => name in draft.semantic).length : 0;

	async function save() {
		const { session, end } = ThemeEditorStore.getState();
		const theme = ThemeStore.getState().preview;

		if (!session || !theme || saving) return;

		setSaving(true);

		const name = session.name.trim();
		const saved = await themes.saveLocal(session.id, theme, {
			name,
			description: session.description.trim(),
		});

		setSaving(false);
		show({
			title: name,
			content: saved ? messages.UNBOUND_THEME_SAVED : messages.UNBOUND_THEME_SAVE_FAILED,
			icon: saved ? 'CircleCheckIcon' : 'CircleXIcon',
		});

		if (!saved) return;

		end();
		navigation.goBack();
	}

	useEffect(() => {
		const actions = <EditorActions saving={saving} onSave={() => void save()} />;

		navigation.setOptions({ headerRight: () => actions });
	}, [saving]);

	if (!session || !draft) return null;

	function discard() {
		ThemeEditorStore.getState().end();
		navigation.goBack();
	}

	return (
		<Page {...scroll}>
			<Discord.TableRowGroup title={messages.UNBOUND_THEME_DETAILS}>
				<InputRow
					label={messages.UNBOUND_THEME_NAME}
					value={session.name}
					placeholder={messages.UNBOUND_THEME_NAME_PLACEHOLDER}
					maxLength={64}
					onChange={(name) => ThemeEditorStore.getState().setDetails({ name })}
				/>
				<InputRow
					label={messages.UNBOUND_THEME_DESCRIPTION}
					value={session.description}
					placeholder={messages.UNBOUND_THEME_DESCRIPTION_PLACEHOLDER}
					variant='multiline'
					maxLength={200}
					onChange={(description) =>
						ThemeEditorStore.getState().setDetails({ description })
					}
				/>
				<PickerRow
					label={messages.UNBOUND_THEME_BASE}
					value={draft.type}
					options={BASES}
					onChange={(type) =>
						isBase(type) && ThemeEditorStore.getState().edit({ ...draft, type })
					}
				/>
			</Discord.TableRowGroup>

			{categories.map(({ title, colors }, index) => (
				<Discord.TableRowGroup
					key={title}
					title={title}
					helperText={index === 0 ? messages.UNBOUND_THEME_COLORS_HINT : undefined}
				>
					{colors.map((color) => (
						<ThemeColorRow
							key={color.tokens[0]}
							label={messages[color.label]}
							tokens={color.tokens}
						/>
					))}
				</Discord.TableRowGroup>
			))}

			<Discord.TableRowGroup>
				<Discord.TableRow
					label={messages.UNBOUND_THEME_ALL_COLORS}
					trailing={
						<Discord.TableRowTrailingText
							text={edited ? format('UNBOUND_THEME_EDITED_COUNT', { edited }) : ''}
						/>
					}
					arrow
					onPress={() => navigation.push(Screens.ThemeColors, {})}
				/>
			</Discord.TableRowGroup>

			<ThemeFileRows />

			<Discord.TableRowGroup>
				<ButtonRow
					label={messages.UNBOUND_THEME_DISCARD}
					variant='danger'
					confirmation={messages.UNBOUND_THEME_DISCARD_CONFIRM}
					onPress={discard}
				/>
			</Discord.TableRowGroup>
		</Page>
	);
}

export default ThemeEditorPage;
