import { IconCircleCheck, IconCircleDashed, IconClock } from 'nucleo-micro-bold';

type IconProps = {
	icon: string;
	color?: string;
};

type IconEntry = {
	component: typeof IconClock;
	/** What the mark means where the guides use it: the roadmap's status column. */
	label: string;
};

// Font Awesome names the guides use, mapped to the site's icon set.
const ICONS: Record<string, IconEntry> = {
	'circle-check': { component: IconCircleCheck, label: 'Implemented' },
	circle: { component: IconCircleDashed, label: 'Planned' },
	clock: { component: IconClock, label: 'In progress' },
};

/**
 * @description An inline status icon, such as the roadmap's implemented, in progress and planned marks.
 * @param props The Font Awesome name and colour the guide gives.
 * @returns The icon, or nothing for a name with no match.
 */
function Icon({ icon, color }: IconProps) {
	const entry = ICONS[icon];

	if (!entry) return null;

	return (
		<entry.component
			size={16}
			role='img'
			aria-label={entry.label}
			className='inline-block align-[-0.2em]'
			style={color ? { color } : undefined}
		/>
	);
}

export default Icon;
