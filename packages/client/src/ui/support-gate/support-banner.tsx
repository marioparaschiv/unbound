import { Image, Pressable } from 'react-native';

import { Discord } from '~/metro/components';
import { messages } from '~/i18n/api';
import { icons } from '~/assets/api';

import useStyles from './support-gate.style';

type SupportBannerProps = { onOpenForum: () => void };

/**
 * @description The red box above the chat input that keeps pointing members who see the support gate to the forum.
 * @param props `onOpenForum` goes to the support forum.
 * @returns The banner.
 */
export default function SupportBanner({ onOpenForum }: SupportBannerProps) {
	const styles = useStyles();

	return (
		<Pressable accessibilityRole='link' onPress={onOpenForum} style={styles.banner}>
			<Image source={icons.WarningIcon} style={styles.bannerIcon} />
			<Discord.Text variant='text-sm/semibold' style={styles.bannerText}>
				{messages.UNBOUND_SUPPORT_BANNER}
			</Discord.Text>
			<Discord.Text variant='text-sm/bold' color='text-link'>
				{messages.UNBOUND_SUPPORT_BANNER_ACTION}
			</Discord.Text>
		</Pressable>
	);
}
