import { openSheet } from '@unbound-plugins/shared/action-sheets/open-sheet';
import { Discord } from '@unbound-app/api/metro/components';
import { assets, metro } from '@unbound-app/api';

import type { EntityKind } from './entity';

import EntityPickerSheet, { type EntityPickerLabels } from './entity-picker-sheet';
import EntityRow from './entity-row';
import useEntity from './use-entity';

/** The texts of an {@link EntityList}, in the plugin's own language. */
export type EntityListLabels = EntityPickerLabels & {
	/** The add row's label, such as "Add user". */
	add: string;
	/** The remove button's accessibility label. */
	remove: string;
};

/** Props of {@link EntityList}. */
export type EntityListProps = {
	kind: EntityKind;
	/** The group's title. */
	title?: string;
	/** Text under the group. */
	description?: string;
	/** The picked ids, in order. */
	value: string[];
	labels: EntityListLabels;
	/** Called with the new ids after each add or removal. */
	onChange: (value: string[]) => void;
};

type ProfileOptions = { userId: string };

type ShowProfile = (options: ProfileOptions) => void;

const ProfileSheet = metro.findByFilePath(
	'modules/user_profile/native/showUserProfileActionSheet.tsx',
) as { default?: ShowProfile } | undefined;

type PickedRowProps = {
	kind: EntityKind;
	id: string;
	labels: EntityListLabels;
	onRemove: () => void;
};

function PickedRow({ kind, id, labels, onRemove }: PickedRowProps) {
	const showProfile = kind === 'user' ? ProfileSheet?.default : undefined;

	return (
		<EntityRow
			entity={useEntity(kind, id)}
			id={id}
			unknownLabel={labels.unknown}
			onPress={showProfile ? () => showProfile({ userId: id }) : undefined}
			trailing={
				<Discord.IconButton
					size='sm'
					variant='secondary'
					icon={assets.getIdByName('TrashIcon')}
					accessibilityLabel={labels.remove}
					onPress={onRemove}
				/>
			}
		/>
	);
}

/**
 * @description A group of picked users, channels or servers drawn as Discord draws them; a user opens their profile.
 * Its add row opens a sheet that searches what Discord has loaded and resolves a pasted id.
 * @param props What it lists, its title, the picked ids, its texts and the change handler.
 * @returns The group.
 */
function EntityList({ kind, title, description, value, labels, onChange }: EntityListProps) {
	function openPicker() {
		openSheet(`unbound-entity-picker-${kind}-${Date.now()}`, EntityPickerSheet, {
			kind,
			labels,
			exclude: value,
			onPick: (id: string) => onChange([...value, id]),
		});
	}

	return (
		<Discord.TableRowGroup title={title} description={description} hasIcons>
			{value.map((id) => (
				<PickedRow
					key={id}
					kind={kind}
					id={id}
					labels={labels}
					onRemove={() => onChange(value.filter((each) => each !== id))}
				/>
			))}
			<Discord.TableRow
				label={labels.add}
				icon={<Discord.TableRow.Icon source={assets.getIdByName('PlusSmallIcon')} />}
				onPress={openPicker}
			/>
		</Discord.TableRowGroup>
	);
}

export default EntityList;
