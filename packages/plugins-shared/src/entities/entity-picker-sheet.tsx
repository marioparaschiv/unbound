import { BottomSheets, Discord, GorhomSheet } from '@unbound-app/api/metro/components';
import type { SheetProps } from '@unbound-plugins/shared/action-sheets/open-sheet';
import { useState } from 'react';

import { isSnowflake, type EntityKind } from './entity';
import useStyles from './entity-picker-sheet.style';
import { searchEntities } from './search';
import EntityRow from './entity-row';
import useEntity from './use-entity';

/** The texts of an {@link EntityPickerSheet}, in the plugin's own language. */
export type EntityPickerLabels = {
	/** The sheet's title, such as "Add user". */
	title: string;
	/** The search field's placeholder, such as "Search or paste an ID". */
	search: string;
	/** Shown when nothing matches. */
	noResults: string;
	/** The second line of a pasted id nothing resolves. */
	unknown: string;
};

/** Props of {@link EntityPickerSheet}. */
export type EntityPickerSheetProps = SheetProps & {
	kind: EntityKind;
	labels: EntityPickerLabels;
	/** Ids already picked, left out of the results. */
	exclude: string[];
	/** Called with the picked id; the sheet closes after. */
	onPick: (id: string) => void;
};

type PastedRowProps = {
	kind: EntityKind;
	id: string;
	unknown: string;
	onPress: () => void;
};

// A pasted id resolves through Discord, which loads a user it has not seen yet.
function PastedRow({ kind, id, unknown, onPress }: PastedRowProps) {
	return (
		<EntityRow entity={useEntity(kind, id)} id={id} unknownLabel={unknown} onPress={onPress} />
	);
}

/**
 * @description A sheet to pick a user, channel or server: a search over what Discord has loaded, and a pasted id resolved.
 * @param props What to pick, the texts, the ids to leave out and what to do with the pick.
 * @returns The sheet.
 */
function EntityPickerSheet({ kind, labels, exclude, onPick, onClose }: EntityPickerSheetProps) {
	const styles = useStyles();
	const { ActionSheet, BottomSheetTitleHeader } = BottomSheets;
	const { BottomSheetScrollView: ScrollView } = GorhomSheet;
	const [query, setQuery] = useState('');
	const pasted = query.trim();
	const results = searchEntities(kind, query, exclude).filter((entity) => entity.id !== pasted);
	const showPasted = isSnowflake(pasted) && !exclude.includes(pasted);

	function pick(id: string) {
		onPick(id);
		onClose();
	}

	return (
		<ActionSheet scrollable>
			<BottomSheetTitleHeader title={labels.title} />
			{/* A `scrollable` sheet scrolls only a bottom-sheet scroll view, which hands the drag between list and sheet. */}
			<ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps='handled'>
				<Discord.SearchBar
					size='md'
					value={query}
					onChange={setQuery}
					placeholder={labels.search}
				/>
				{showPasted || results.length ? (
					<Discord.TableRowGroup hasIcons>
						{showPasted ? (
							<PastedRow
								kind={kind}
								id={pasted}
								unknown={labels.unknown}
								onPress={() => pick(pasted)}
							/>
						) : null}
						{results.map((entity) => (
							<EntityRow
								key={entity.id}
								entity={entity}
								id={entity.id}
								unknownLabel={labels.unknown}
								onPress={() => pick(entity.id)}
							/>
						))}
					</Discord.TableRowGroup>
				) : (
					<Discord.Text variant='text-sm/medium' color='text-muted' style={styles.none}>
						{labels.noResults}
					</Discord.Text>
				)}
			</ScrollView>
		</ActionSheet>
	);
}

export default EntityPickerSheet;
