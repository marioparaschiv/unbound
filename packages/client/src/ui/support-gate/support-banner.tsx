import { Image, Pressable, View } from 'react-native';
import { useState } from 'react';

import { Discord } from '~/metro/components';
import { messages } from '~/i18n/api';
import { icons } from '~/assets/api';

import useStyles from './support-gate.style';

type SupportBannerProps = { onOpenForum: () => void; onDismiss: () => void };

/**
 * @description The card above the chat input that keeps pointing members who see the support gate to the forum.
 * @param props `onOpenForum` goes to the support forum; `onDismiss` remembers the banner was closed.
 * @returns The banner, or nothing once dismissed.
 */
export default function SupportBanner({ onOpenForum, onDismiss }: SupportBannerProps) {
	const styles = useStyles();
	const [hidden, setHidden] = useState(false);

	if (hidden) return null;

	function dismiss() {
		setHidden(true);
		onDismiss();
	}

	return (
		<View style={styles.banner}>
			<Pressable accessibilityRole='link' onPress={onOpenForum} style={styles.bannerBody}>
				<Image source={icons.WarningIcon} style={styles.bannerIcon} />
				<View style={styles.bannerText}>
					<Discord.Text variant='body-sm/semibold' color='mobile-text-heading-primary'>
						{messages.UNBOUND_SUPPORT_BANNER}
					</Discord.Text>
					<Discord.Text variant='body-sm/medium' color='text-link'>
						{messages.UNBOUND_SUPPORT_BANNER_ACTION}
					</Discord.Text>
				</View>
			</Pressable>
			<Discord.IconButton
				size='sm'
				variant='tertiary'
				icon={icons['XSmallIcon'] ?? 0}
				accessibilityLabel={messages.UNBOUND_SUPPORT_BANNER_DISMISS}
				hitSlop={10}
				onPress={dismiss}
			/>
		</View>
	);
}
