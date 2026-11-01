import type { GuideIconName } from '~/lib/guides/guide-icon-names';
import { GUIDE_ICONS } from '~/components/guides/guide-icons';

type IconProps = {
	icon: GuideIconName;
	color?: string;
	/** What the icon means; without one it is decorative. */
	label?: string;
};

/**
 * @description An inline icon in running text or a table cell, such as the roadmap's status marks.
 * @param props The icon name, its colour and what it means.
 * @returns The icon.
 */
function Icon({ icon, color, label }: IconProps) {
	const Glyph = GUIDE_ICONS[icon];

	return (
		<Glyph
			size={16}
			role={label ? 'img' : undefined}
			aria-label={label}
			aria-hidden={label ? undefined : true}
			className='inline-block align-[-0.2em]'
			style={color ? { color } : undefined}
		/>
	);
}

export default Icon;
