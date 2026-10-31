import type { DesignModule } from '@unbound-app/types/components';
import type { ComponentProps } from 'react';
import { Text } from 'react-native';

type TextProps = ComponentProps<DesignModule['Text']>;

type EllipsizeMode = NonNullable<ComponentProps<typeof Text>['ellipsizeMode']>;

const ELLIPSIZE_MODES: readonly EllipsizeMode[] = ['head', 'middle', 'tail', 'clip'];

function isEllipsizeMode(value: TextProps['ellipsizeMode']): value is EllipsizeMode {
	return typeof value === 'string' && (ELLIPSIZE_MODES as readonly string[]).includes(value);
}

/**
 * @description Unbound's stand-in for Discord's `Text`: plain React Native text with the same text props.
 * @param props The text props.
 * @returns The text element.
 */
function FallbackText({
	children,
	style,
	numberOfLines,
	lineClamp,
	ellipsizeMode,
	allowFontScaling,
}: TextProps) {
	const lines = numberOfLines ?? lineClamp;

	return (
		<Text
			style={style}
			numberOfLines={typeof lines === 'number' ? lines : undefined}
			ellipsizeMode={isEllipsizeMode(ellipsizeMode) ? ellipsizeMode : undefined}
			allowFontScaling={typeof allowFontScaling === 'boolean' ? allowFontScaling : undefined}
		>
			{children}
		</Text>
	);
}

export default FallbackText;
