import type { ColorValue } from 'react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Discord } from '~/api/metro/components';
import { Theme } from '~/api/metro/common';
import { Icons } from '~/api/assets';

import useStyles from './help-message.style';
import TintedIcon from './tinted-icon';

export const HelpMessageTypes = {
	0: 'WARNING',
	1: 'INFO',
	2: 'ERROR',
	3: 'SUCCESS',
	WARNING: 0,
	INFO: 1,
	ERROR: 2,
	SUCCESS: 3,
} as const;

type HelpMessageType = (typeof HelpMessageTypes)[keyof typeof HelpMessageTypes & string];

export type HelpMessageProps = {
	children?: ReactNode;
	messageType?: HelpMessageType;
	textVariant?: string;
	textColor?: ColorValue;
	borderRadius?: number;
	button?: ReactNode;
};

const TONES = {
	[HelpMessageTypes.WARNING]: { icon: 'WarningIcon', tone: 'WARNING' },
	[HelpMessageTypes.INFO]: { icon: 'CircleInformationIcon', tone: 'INFO' },
	[HelpMessageTypes.ERROR]: { icon: 'CircleXIcon', tone: 'CRITICAL' },
	[HelpMessageTypes.SUCCESS]: { icon: 'CircleCheckIcon', tone: 'POSITIVE' },
} as const;

/**
 * @description A tinted notice with an icon, shaped like Discord's `HelpMessage`, for Discord builds that no longer ship it.
 * @param props The message, its type, text styling, corner radius and an optional trailing button.
 * @returns The notice.
 */
function HelpMessage({
	children,
	messageType = HelpMessageTypes.WARNING,
	textVariant = 'text-sm/medium',
	textColor,
	borderRadius = 8,
	button,
}: HelpMessageProps) {
	const styles = useStyles();
	const { icon, tone } = TONES[messageType] ?? TONES[HelpMessageTypes.WARNING];
	const background = Discord.useToken(Theme.colors[`BACKGROUND_FEEDBACK_${tone}`]);
	const border = Discord.useToken(Theme.colors[`BORDER_FEEDBACK_${tone}`]);
	const tint = Discord.useToken(Theme.colors[`ICON_FEEDBACK_${tone}`]);
	const text = Discord.useToken(Theme.colors.TEXT_DEFAULT);

	return (
		<View
			style={[
				styles.container,
				{
					borderRadius,
					backgroundColor: background,
					borderColor: border,
				},
			]}
		>
			<TintedIcon source={Icons[icon] ?? 0} size={20} tint={tint} />
			<View style={styles.text}>
				{typeof children === 'string' || typeof children === 'number' ? (
					<Discord.Text variant={textVariant} style={{ color: textColor ?? text }}>
						{children}
					</Discord.Text>
				) : (
					children
				)}
			</View>
			{button ? <View style={styles.button}>{button}</View> : null}
		</View>
	);
}

export default HelpMessage;
