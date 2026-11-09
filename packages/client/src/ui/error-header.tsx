import { View } from 'react-native';

import { Discord } from '~/metro/components';
import { messages } from '~/i18n/api';
import Logo from '~/ui/icons/logo';

import useStyles from './error-boundary.style';

/**
 * @description The crash screen's top card: what happened, beside the Unbound logo.
 */
function ErrorHeader() {
	const styles = useStyles();

	return (
		<Discord.Card variant='primary' border='subtle' shadow='low' style={styles.card}>
			<Discord.Stack direction='horizontal' spacing={16}>
				<View style={styles.header}>
					<Discord.Text variant='heading-lg/semibold' color='mobile-text-heading-primary'>
						{messages.UNBOUND_CRASH_TITLE}
					</Discord.Text>
					<Discord.Text variant='text-sm/normal' color='text-muted'>
						{messages.UNBOUND_CRASH_DESCRIPTION}
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
