import { BottomSheets } from '~/api/metro/components';
import { format } from '~/api/i18n';

export type ShareDestination = {
	channelId: string;
	guildId: string;
	label: string;
	subLabel: string;
};

type ShareDestinationSheetProps = {
	destinations: ShareDestination[];
	count: number;
	onSelect: (destination: ShareDestination) => void;
};

/**
 * @description An action sheet of recent channels and DMs that shared files can go to.
 */
function ShareDestinationSheet({ destinations, count, onSelect }: ShareDestinationSheetProps) {
	const { ActionSheet, ActionSheetRow, BottomSheetTitleHeader } = BottomSheets;

	return (
		<ActionSheet>
			<BottomSheetTitleHeader title={format('UNBOUND_SHARE_PICK', { count })} />
			<ActionSheetRow.Group>
				{destinations.map((destination) => (
					<ActionSheetRow
						key={destination.channelId}
						label={destination.label}
						subLabel={destination.subLabel || void 0}
						onPress={() => onSelect(destination)}
					/>
				))}
			</ActionSheetRow.Group>
		</ActionSheet>
	);
}

export default ShareDestinationSheet;
