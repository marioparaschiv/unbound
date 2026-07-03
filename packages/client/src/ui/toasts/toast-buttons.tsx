import type { ToastButton } from '@unbound-app/types/toasts';
import { View } from 'react-native';
import { memo } from 'react';

import { Discord } from '~/api/metro/components';

import useStyles from './toast.style';

type ToastButtonsProps = {
	buttons: ToastButton[];
};

function ToastButtons({ buttons }: ToastButtonsProps) {
	const styles = useStyles();

	return (
		<View style={[styles.buttons, { marginTop: 5 }]}>
			{buttons.map((button, index) => (
				<Discord.Button
					key={index}
					style={styles.button}
					variant={button.variant || 'primary'}
					size={button.size || 'sm'}
					onPress={button.onPress}
					iconPosition={button.iconPosition || 'start'}
					icon={button.icon || undefined}
					text={button.content}
				/>
			))}
		</View>
	);
}

export default memo(ToastButtons);
