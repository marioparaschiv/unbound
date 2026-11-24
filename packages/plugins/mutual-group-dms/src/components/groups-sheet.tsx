import { describeEntity } from '@unbound-plugins/shared/entities/describe';
import { BottomSheets, Discord, GorhomSheet } from '@unbound-app/api/metro/components';
import EntityRow from '@unbound-plugins/shared/entities/entity-row';
import type { SheetProps } from '@unbound-plugins/shared/action-sheets/open-sheet';
import { messages } from '@unbound-app/i18n';
import { metro } from '@unbound-app/api';

import useStyles from '~/components/groups-sheet.style';
import type { MutualGroup } from '~/lib/groups';

/** Props of {@link GroupsSheet}. */
export type GroupsSheetProps = SheetProps & { groups: MutualGroup[] };

/**
 * @description A sheet listing the group DMs shared with a user; pressing one opens it.
 * @param props The groups and what closes the sheet.
 * @returns The sheet.
 */
function GroupsSheet({ groups, onClose }: GroupsSheetProps) {
	const styles = useStyles();
	const { ActionSheet, BottomSheetTitleHeader } = BottomSheets;
	const { BottomSheetScrollView: ScrollView } = GorhomSheet;

	function open(channelId: string) {
		onClose();
		metro.findByProps('transitionToChannel')?.transitionToChannel?.(channelId);
	}

	return (
		<ActionSheet scrollable>
			<BottomSheetTitleHeader title={messages.MUTUAL_GROUP_DMS_TITLE} />
			<ScrollView contentContainerStyle={styles.body}>
				<Discord.TableRowGroup hasIcons>
					{groups.map((group) => (
						<EntityRow
							key={group.id}
							entity={describeEntity('group', group.id)}
							id={group.id}
							unknownLabel={group.name}
							onPress={() => open(group.id)}
						/>
					))}
				</Discord.TableRowGroup>
			</ScrollView>
		</ActionSheet>
	);
}

export default GroupsSheet;
