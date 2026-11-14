import { BottomSheets } from '~/metro/components';

export type ShareDestination = {
	channelId: string;
	guildId: string;
	label: string;
	subLabel: string;
};

type ShareDestinationSheetProps = {
	destinations: ShareDestination[];
	title: string;
	onSelect: (destination: ShareDestination) => void;
};

/**
 * @description An action sheet of recent channels and DMs that shared files and text can go to.
 */
function ShareDestinationSheet({ destinations, title, onSelect }: ShareDestinationSheetProps) {
	const { ActionSheet, ActionSheetRow, BottomSheetTitleHeader } = BottomSheets;

	return (
		<ActionSheet>
			<BottomSheetTitleHeader title={title} />
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
