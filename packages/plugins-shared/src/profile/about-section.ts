import { createElement, type ComponentType, type ReactNode } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import { Discord } from '@unbound-app/api/metro/components';
import { metro } from '@unbound-app/api';

type IconProps = { size?: string };

export type AboutSectionProps = {
	title: string;
	icon?: string;
	children: ReactNode;
	onPress?: () => void;
	link?: boolean;
	accessibilityHint?: string;
};

const ROW: ViewStyle = { flexDirection: 'row', alignItems: 'center', columnGap: 6 };
const HEADING_SPACING = 8;

function iconComponent(name: string): ComponentType<IconProps> | undefined {
	return metro.findByProps(name)?.[name] as ComponentType<IconProps> | undefined;
}

/**
 * @description Draws a section of a profile's About card the way Discord draws Member Since: a heading, then an icon and a line of text.
 * @param props The heading, the icon's name in Discord's icon set, the line, an optional press handler, and whether the line is a link.
 * @returns The section.
 */
export function AboutSection({
	title,
	icon,
	children,
	onPress,
	link = false,
	accessibilityHint,
}: AboutSectionProps) {
	const Icon = icon ? iconComponent(icon) : undefined;
	const row = createElement(
		View,
		{ style: ROW },
		Icon ? createElement(Icon, { size: 'xs' }) : null,
		createElement(
			Discord.Text,
			{ variant: 'text-md/normal', color: link ? 'text-link' : 'text-default' },
			children,
		),
	);

	return createElement(
		View,
		null,
		createElement(
			Discord.Text,
			{
				accessibilityRole: 'header',
				variant: 'text-sm/semibold',
				color: 'user-profile-about-me-heading-text',
				style: { marginBottom: HEADING_SPACING },
			},
			title,
		),
		onPress
			? createElement(
					Pressable,
					{ accessibilityRole: 'button', accessibilityHint, onPress },
					row,
				)
			: row,
	);
}

export default { AboutSection };
