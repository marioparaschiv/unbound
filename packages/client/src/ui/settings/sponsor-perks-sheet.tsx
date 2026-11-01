import { View } from 'react-native';

import { BottomSheets, Discord } from '~/metro/components';
import PixelHeart from '~/ui/components/pixel-heart';
import { SOCIAL_LINKS } from '~/core/constants';
import { messages } from '~/i18n/api';
import { Linking } from '~/metro/api';
import { icons } from '~/assets/api';

import useStyles from './sponsor-perks-sheet.style';

type SponsorPerksSheetProps = {
	onClose: () => void;
};

/**
 * @description An action sheet listing what sponsoring Unbound unlocks, under a spinning pixel heart,
 * with a button that opens GitHub Sponsors.
 */
function SponsorPerksSheet({ onClose }: SponsorPerksSheetProps) {
	const styles = useStyles();
	const { ActionSheet, ActionSheetRow } = BottomSheets;

	function sponsor() {
		onClose();
		Linking.openURL(SOCIAL_LINKS.Sponsor);
	}

	return (
		<ActionSheet>
			<View style={styles.hero}>
				<View style={styles.heart}>
					<PixelHeart size={84} />
				</View>
				<Discord.Text variant='heading-lg/bold' color='mobile-text-heading-primary'>
					{messages.UNBOUND_SPONSOR_PERKS_TITLE}
				</Discord.Text>
				<Discord.Text variant='text-sm/medium' color='text-muted' style={styles.subtitle}>
					{messages.UNBOUND_SPONSOR_PERKS_PRICE}
				</Discord.Text>
			</View>
			<ActionSheetRow.Group hasIcons>
				<ActionSheetRow
					label={messages.UNBOUND_SPONSOR_PERK_BADGE}
					subLabel={messages.UNBOUND_SPONSOR_PERK_BADGE_DESC}
					icon={<ActionSheetRow.Icon source={icons.StarIcon} />}
				/>
				<ActionSheetRow
					label={messages.UNBOUND_SPONSOR_PERK_ROLE}
					subLabel={messages.UNBOUND_SPONSOR_PERK_ROLE_DESC}
					icon={<ActionSheetRow.Icon source={icons.ShieldUserIcon ?? icons.ServerIcon} />}
				/>
			</ActionSheetRow.Group>
			<View style={styles.action}>
				<Discord.Button
					text={messages.UNBOUND_SPONSOR}
					variant='primary'
					size='lg'
					onPress={sponsor}
				/>
			</View>
		</ActionSheet>
	);
}

export default SponsorPerksSheet;
