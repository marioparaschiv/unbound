import { useEffect, useMemo, useRef, useState } from 'react';
import type { Theme } from '@unbound-app/types';

import { createDraft, isEdited, readDraft } from '~/lib/theme-draft';
import { createLocalThemeId } from '~/lib/local-themes';
import type { LocalThemeId } from '~/lib/local-themes';
import { Discord } from '~/api/metro/components';
import { Messages, format } from '~/api/i18n';
import { themes } from '~/managers/themes';
import { Screens } from '~/lib/constants';
import { showToast } from '~/api/toasts';
import ThemeStore from '~/stores/themes';
import { Page } from '~/ui/components';

import { ADVANCED_GROUPS, BASIC_CATEGORIES, availableRows, groupTokens } from './token-registry';
import { currentAppearance, liveTokenNames } from './token-color';
import TokenGroupPage from './token-group-page';
import ColorRow from './color-row';

type ThemeEditorParams = {
	id?: LocalThemeId;
};

type ThemeEditorPageProps = {
	route: { params?: ThemeEditorParams };
};

/** What the editor opened with; every dirty check compares against it. */
type EditorSession = {
	id: LocalThemeId;
	initial: Theme;
	name: string;
	description: string;
};

type BeforeRemoveEvent = {
	preventDefault: () => void;
};

function openSession(id: LocalThemeId | undefined): EditorSession {
	const entity = id ? themes.getEntity(id) : undefined;
	const bundle = entity ? readDraft(entity.bundle) : undefined;

	return {
		// The id is fixed for the session, so saving twice or retrying overwrites one theme.
		id: id ?? createLocalThemeId(),
		initial: bundle ?? createDraft(currentAppearance()),
		name: entity?.data.name ?? '',
		description: entity?.data.description ?? '',
	};
}

/**
 * @description The theme editor: name and description, the curated colours, and every Discord colour by
 * group. Discord shows the draft while the editor is open; leaving without saving drops it.
 */
function ThemeEditorPage({ route }: ThemeEditorPageProps) {
	const navigation = Discord.useNavigation();
	const [session] = useState(() => openSession(route.params?.id));
	const [name, setName] = useState(session.name);
	const [description, setDescription] = useState(session.description);
	const [busy, setBusy] = useState(false);
	const preview = ThemeStore((state) => state.preview);
	const saved = useRef(false);
	const discarding = useRef(false);
	const dirty = useRef(false);

	const names = useMemo(() => liveTokenNames(), []);
	const groups = useMemo(() => groupTokens(names), [names]);
	const categories = useMemo(() => {
		const live = new Set(names);

		return BASIC_CATEGORIES.map((category) => ({
			category,
			rows: availableRows(category, live),
		})).filter(({ rows }) => rows.length);
	}, [names]);

	useEffect(() => {
		dirty.current =
			(preview !== null && preview !== session.initial) ||
			name !== session.name ||
			description !== session.description;
	}, [preview, name, description]);

	const canSave = Boolean(name.trim()) && !busy;

	useEffect(() => {
		ThemeStore.getState().setPreview(session.initial);

		return () => ThemeStore.getState().setPreview(null);
	}, []);

	async function save() {
		const draft = ThemeStore.getState().preview;

		if (!draft || !canSave) return;

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

		saved.current = true;
		navigation.goBack();
	}

	useEffect(() => {
		navigation.setOptions({
			title: session.name || Messages.UNBOUND_THEME_EDITOR,
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
	}, [canSave, busy, name, description]);

	useEffect(
		() =>
			navigation.addListener('beforeRemove', (event: BeforeRemoveEvent) => {
				if (saved.current || discarding.current || !dirty.current) return;

				event.preventDefault();

				Discord.showConfirmModal({
					title: Messages.UNBOUND_THEME_DISCARD,
					content: Messages.UNBOUND_THEME_DISCARD_CONFIRM,
					confirmText: Messages.UNBOUND_THEME_DISCARD,
					cancelText: Messages.UNBOUND_CANCEL,
					onConfirm: () => {
						discarding.current = true;
						navigation.goBack();
					},
				});
			}),
		[],
	);

	function openGroup(key: string, title: string) {
		navigation.push(Screens.Custom, {
			title,
			render: () => <TokenGroupPage tokens={groups.get(key) ?? []} />,
		});
	}

	return (
		<Page>
			<Discord.TableRowGroup
				title={Messages.UNBOUND_THEME_DETAILS}
				description={Messages.UNBOUND_THEME_EDITOR_HINT}
			>
				<Discord.TableRow label={Messages.UNBOUND_THEME_NAME}>
					<Discord.TextInput
						value={name}
						placeholder={Messages.UNBOUND_THEME_NAME_PLACEHOLDER}
						onChange={setName}
					/>
				</Discord.TableRow>
				<Discord.TableRow label={Messages.UNBOUND_THEME_DESCRIPTION}>
					<Discord.TextInput
						value={description}
						placeholder={Messages.UNBOUND_THEME_DESCRIPTION_PLACEHOLDER}
						multiline
						onChange={setDescription}
					/>
				</Discord.TableRow>
			</Discord.TableRowGroup>

			{categories.map(({ category, rows }) => (
				<Discord.TableRowGroup key={category.key} title={format(category.title)}>
					{rows.map((row) => (
						<ColorRow key={row.key} label={format(row.label)} tokens={row.tokens} />
					))}
				</Discord.TableRowGroup>
			))}

			<Discord.TableRowGroup
				title={Messages.UNBOUND_THEME_ADVANCED}
				description={Messages.UNBOUND_THEME_ADVANCED_HINT}
			>
				{ADVANCED_GROUPS.map(({ key, title }) => {
					const tokens = groups.get(key) ?? [];
					const edited = preview
						? tokens.filter((token) => isEdited(preview, [token])).length
						: 0;

					return tokens.length ? (
						<Discord.TableRow
							key={key}
							label={format(title)}
							arrow
							trailing={
								<Discord.TableRow.TrailingText
									text={
										edited
											? format('UNBOUND_THEME_EDITED_COUNT', {
													edited,
													total: tokens.length,
												})
											: String(tokens.length)
									}
								/>
							}
							onPress={() => openGroup(key, format(title))}
						/>
					) : null;
				})}
			</Discord.TableRowGroup>
		</Page>
	);
}

export default ThemeEditorPage;
