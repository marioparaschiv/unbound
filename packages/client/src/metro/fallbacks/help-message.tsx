import type { ColorValue } from 'react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Discord, isRenderable } from '~/metro/design';
import { icons } from '~/assets/api';

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

/** A `HelpMessage` style: one of the `HelpMessageTypes` values. */
type HelpMessageType = (typeof HelpMessageTypes)[keyof typeof HelpMessageTypes & string];

/** Props for `HelpMessage`; the defaults named here are those of Unbound's fallback. */
export type HelpMessageProps = {
	/** The message; a string or number is rendered as text, any other node as given. */
	children?: ReactNode;
	/** A `HelpMessageTypes` value that picks the icon and feedback colors; `WARNING` when omitted. */
	messageType?: HelpMessageType;
	/** Discord's text variant for string children; `text-sm/medium` when omitted. */
	textVariant?: string;
	/** The color of string children; the theme's default text color when omitted. */
	textColor?: ColorValue;
	/** The corner radius in density-independent pixels; `8` when omitted. */
	borderRadius?: number;
	/** A node, usually a button, rendered after the message. */
	button?: ReactNode;
};

const TONES = {
	[HelpMessageTypes.WARNING]: { icon: 'WarningIcon', tone: 'warning' },
	[HelpMessageTypes.INFO]: { icon: 'CircleInformationIcon', tone: 'info' },
	[HelpMessageTypes.ERROR]: { icon: 'CircleXIcon', tone: 'critical' },
	[HelpMessageTypes.SUCCESS]: { icon: 'CircleCheckIcon', tone: 'positive' },
} as const;

/**
 * @description For Discord builds that no longer ship `HelpMessage`: Discord's `InlineNotice` for a plain-text
 * message, else a tinted notice with an icon shaped like `HelpMessage`, which also takes a button and text styling.
 * @param props The message, its type, text styling, corner radius and an optional trailing button.
 * @returns The notice.
 */
function HelpMessage({
	children,
	messageType = HelpMessageTypes.WARNING,
	textVariant,
	textColor,
	borderRadius,
	button,
}: HelpMessageProps) {
	const styles = useStyles();
	const { icon, tone } = TONES[messageType] ?? TONES[HelpMessageTypes.WARNING];
	const text = typeof children === 'string' || typeof children === 'number';
	const styled =
		textVariant !== undefined || textColor !== undefined || borderRadius !== undefined;

	// The tones are InlineNotice's own types; it draws only text, so a button or custom styling keeps Unbound's.
	if (text && !styled && !button && isRenderable(Discord.InlineNotice)) {
		return <Discord.InlineNotice type={tone} message={String(children)} />;
	}

	return (
		<View style={[styles.container, styles[tone], { borderRadius: borderRadius ?? 8 }]}>
			<TintedIcon source={icons[icon] ?? 0} size={20} style={styles[`${tone}Icon`]} />
			<View style={styles.text}>
				{text ? (
					<Discord.Text
						variant={textVariant ?? 'text-sm/medium'}
						style={[
							styles.message,
							textColor === undefined ? null : { color: textColor },
						]}
					>
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
