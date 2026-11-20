import { View } from 'react-native';

import { format, messages } from '~/i18n/api';
import { Discord } from '~/metro/components';
import Logo from '~/ui/icons/logo';

import useStyles from './error-boundary.style';

/**
 * @description The crash screen's top card: what happened, beside the Unbound logo.
 */
type ErrorHeaderProps = { plugin?: string };

function ErrorHeader({ plugin }: ErrorHeaderProps) {
	const styles = useStyles();

	return (
		<Discord.Card variant='primary' border='subtle' shadow='low' style={styles.card}>
			<Discord.Stack direction='horizontal' spacing={16}>
				<View style={styles.header}>
					<Discord.Text variant='heading-lg/semibold' color='mobile-text-heading-primary'>
						{messages.UNBOUND_CRASH_TITLE}
					</Discord.Text>
					<Discord.Text variant='text-sm/normal' color='text-muted'>
						{plugin
							? format('UNBOUND_CRASH_DESCRIPTION_PLUGIN', { name: plugin })
							: messages.UNBOUND_CRASH_DESCRIPTION}
					</Discord.Text>
				</View>
				<View style={styles.logo}>
					<Logo height={48} tint={styles.logoTint.color} />
				</View>
			</Discord.Stack>
		</Discord.Card>
	);
}

export default ErrorHeader;
