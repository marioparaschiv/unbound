import { useEffect, useMemo, useState } from 'react';

import ThemeEditorStore from '~/stores/theme-editor';
import { Discord } from '~/api/metro/components';
import { Messages, format } from '~/api/i18n';
import { isEdited } from '~/lib/theme-draft';
import { themes } from '~/managers/themes';
import { Screens } from '~/lib/constants';
import { showToast } from '~/api/toasts';
import ThemeStore from '~/stores/themes';
import { Page } from '~/ui/components';

import { BASIC_CATEGORIES, availableRows, groupTokens } from './token-registry';
import AdvancedGroupsPage from './advanced-groups-page';
import useEditorScreen from './use-editor-screen';
import { liveTokenNames } from './token-color';
import ColorRow from './color-row';

/**
 * @description The theme editor: name and description, the curated colours, and a link to every Discord
 * colour by group. The draft stays applied after leaving until it is saved or discarded.
 */
function ThemeEditorPage() {
	const navigation = Discord.useNavigation();
	const session = ThemeEditorStore((state) => state.session);
	const preview = ThemeStore((state) => state.preview);
	const [busy, setBusy] = useState(false);

	useEditorScreen();

	const name = session?.name ?? '';
	const description = session?.description ?? '';
	const names = useMemo(() => liveTokenNames(), []);
	const groups = useMemo(() => groupTokens(names), [names]);
	const categories = useMemo(() => {
		const live = new Set(names);

		return BASIC_CATEGORIES.map((category) => ({
			category,
			rows: availableRows(category, live),
		})).filter(({ rows }) => rows.length);
	}, [names]);

	const edited = preview ? names.filter((token) => isEdited(preview, [token])).length : 0;
	const canSave = Boolean(name.trim()) && !busy;

	async function save() {
		const draft = ThemeStore.getState().preview;

		if (!session || !draft || !canSave) return;

		setBusy(true);

		const entity = await themes.saveLocal(session.id, draft, {
			name: name.trim(),
			description: description.trim(),
		});

		setBusy(false);

		if (!entity) {
			showToast({
				title: name.trim(),
				content: format('UNBOUND_THEME_SAVE_FAILED'),
				icon: 'CircleXIcon',
			});

			return;
		}

		ThemeEditorStore.getState().end();
		navigation.goBack();
	}

	useEffect(() => {
		navigation.setOptions({
			title: name.trim() || Messages.UNBOUND_THEME_EDITOR,
			headerRight: () => (
				<Discord.Button
					size='sm'
					variant='primary'
					text={format('UNBOUND_SAVE')}
					disabled={!canSave}
					loading={busy}
					onPress={save}
				/>
			),
		});
	}, [canSave, busy, session]);

	function discard() {
		Discord.showConfirmModal({
			title: Messages.UNBOUND_THEME_DISCARD,
			content: Messages.UNBOUND_THEME_DISCARD_CONFIRM,
			confirmText: Messages.UNBOUND_THEME_DISCARD,
			cancelText: Messages.UNBOUND_CANCEL,
			onConfirm: () => {
				ThemeEditorStore.getState().end();
				navigation.goBack();
			},
		});
	}

	function openAdvanced() {
		navigation.push(Screens.Custom, {
			title: Messages.UNBOUND_THEME_ADVANCED,
			render: () => <AdvancedGroupsPage groups={groups} />,
		});
	}

	return (
		<Page>
			<Discord.Stack spacing={8}>
				<Discord.TableRowGroupTitle title={Messages.UNBOUND_THEME_NAME} />
				<Discord.TextInput
					value={name}
					placeholder={Messages.UNBOUND_THEME_NAME_PLACEHOLDER}
					onChange={(value: string) =>
						ThemeEditorStore.getState().setDetails({ name: value })
					}
				/>
			</Discord.Stack>
			<Discord.Stack spacing={8}>
				<Discord.TableRowGroupTitle title={Messages.UNBOUND_THEME_DESCRIPTION} />
				<Discord.TextInput
					value={description}
					placeholder={Messages.UNBOUND_THEME_DESCRIPTION_PLACEHOLDER}
					onChange={(value: string) =>
						ThemeEditorStore.getState().setDetails({ description: value })
					}
				/>
			</Discord.Stack>

			{categories.map(({ category, rows }, index) => (
				<Discord.TableRowGroup
					key={category.key}
					title={format(category.title)}
					description={index === 0 ? Messages.UNBOUND_THEME_EDITOR_HINT : undefined}
				>
					{rows.map((row) => (
						<ColorRow key={row.key} label={format(row.label)} tokens={row.tokens} />
					))}
				</Discord.TableRowGroup>
			))}

			<Discord.TableRowGroup>
				<Discord.TableRow
					label={Messages.UNBOUND_THEME_ADVANCED}
					subLabel={Messages.UNBOUND_THEME_ADVANCED_HINT}
					arrow
					trailing={
						<Discord.TableRow.TrailingText
							text={
								edited
									? format('UNBOUND_THEME_EDITED_COUNT', {
											edited,
											total: names.length,
										})
									: String(names.length)
							}
						/>
					}
					onPress={openAdvanced}
				/>
			</Discord.TableRowGroup>

			<Discord.TableRowGroup>
				<Discord.TableRow
					label={Messages.UNBOUND_THEME_DISCARD}
					variant='danger'
					onPress={discard}
				/>
			</Discord.TableRowGroup>
		</Page>
	);
}

export default ThemeEditorPage;
