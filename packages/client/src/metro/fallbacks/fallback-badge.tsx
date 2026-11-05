import type { BadgeProps, DesignModule } from '@unbound-app/types/components';
import type { ComponentProps } from 'react';
import { View } from 'react-native';

import { Discord } from '~/metro/design';

import useStyles from './fallback-badge.style';

const LABELS: Record<Extract<BadgeProps['type'], string>, string> = {
	new: 'New',
	beta: 'Beta',
	early_access: 'Early access',
	free_trial: 'Free trial',
};

/**
 * @description Unbound's stand-in for Discord's `Badge`, which builds before 352 lack: a one-line pill, brand
 * coloured for the `primary` variant and grey otherwise.
 * @param props The badge props.
 * @returns The badge element.
 */
function FallbackBadge({ type, variant }: ComponentProps<DesignModule['Badge']>) {
	const styles = useStyles();
	const brand = variant === 'primary';
	const label: string | undefined = typeof type === 'string' ? LABELS[type] : type?.text;

	return (
		<View style={[styles.badge, brand ? styles.brand : null]}>
			<Discord.Text
				variant='text-xxs/bold'
				numberOfLines={1}
				style={[styles.label, brand ? styles.brandLabel : null]}
			>
				{label}
			</Discord.Text>
		</View>
	);
}

export default FallbackBadge;
