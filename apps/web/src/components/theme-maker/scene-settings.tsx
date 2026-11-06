import {
	IconAccessibility,
	IconArrowLeft,
	IconBell,
	IconCheck,
	IconChevronRight,
	IconLock,
	IconMagnifier,
	IconMobile,
	IconPaintbrush,
	IconPalette,
	IconPuzzlePiece,
	IconShield,
	IconUser,
} from 'nucleo-micro-bold';
import type { ComponentType, ReactNode } from 'react';

import type { SceneProps } from '~/components/theme-maker/scene-parts';
import { PhoneScreen } from '~/components/theme-maker/scene-parts';

type IconProps = {
	size?: number;
};

type Trailing = 'arrow' | 'on' | 'off' | 'checked';

type GroupProps = SceneProps & {
	title: string;
	children: ReactNode;
};

type RowProps = SceneProps & {
	icon: ComponentType<IconProps>;
	label: string;
	subLabel?: string;
	trailing?: Trailing;
	first?: boolean;
};

function Switch({ colors, on }: SceneProps & { on: boolean }) {
	return (
		<span
			className='flex items-center p-0.5 rounded-full w-11 h-6 shrink-0'
			style={{
				background: colors(on ? 'switchOn' : 'switchOff'),
				boxShadow: on ? undefined : `inset 0 0 0 1px ${colors('switchOffBorder')}`,
				justifyContent: on ? 'flex-end' : 'flex-start',
			}}
		>
			<span className='rounded-full size-5' style={{ background: colors('switchThumb') }} />
		</span>
	);
}

function TrailingControl({ colors, trailing }: SceneProps & { trailing: Trailing }) {
	if (trailing === 'arrow') {
		return <IconChevronRight size={14} style={{ color: colors('iconMuted') }} />;
	}

	if (trailing === 'checked') {
		return (
			<span
				className='flex justify-center items-center rounded-md size-6 shrink-0'
				style={{ background: colors('checkboxOn'), color: colors('checkboxIcon') }}
			>
				<IconCheck size={14} />
			</span>
		);
	}

	return <Switch colors={colors} on={trailing === 'on'} />;
}

function Row({ colors, icon: Icon, label, subLabel, trailing = 'arrow', first = false }: RowProps) {
	return (
		<div
			className='flex items-center gap-3 px-4 py-2.5'
			style={{ boxShadow: first ? undefined : `inset 0 1px 0 ${colors('divider')}` }}
		>
			<span style={{ color: colors('rowIcon') }}>
				<Icon size={18} />
			</span>
			<span className='flex flex-col flex-1 gap-0.5 min-w-0'>
				<span className='font-semibold text-[15px]' style={{ color: colors('textStrong') }}>
					{label}
				</span>
				{subLabel ? (
					<span className='text-[12px] truncate' style={{ color: colors('textMuted') }}>
						{subLabel}
					</span>
				) : null}
			</span>
			<TrailingControl colors={colors} trailing={trailing} />
		</div>
	);
}

function Group({ colors, title, children }: GroupProps) {
	return (
		<div className='flex flex-col gap-1.5'>
			<span className='px-1 font-semibold text-[12px]' style={{ color: colors('textMuted') }}>
				{title}
			</span>
			<div
				className='rounded-2xl overflow-hidden'
				style={{
					background: colors('row'),
					boxShadow: `inset 0 0 0 1px ${colors('divider')}`,
				}}
			>
				{children}
			</div>
		</div>
	);
}

/**
 * @description Discord's mobile settings: a search field, then account, Unbound and app settings as table rows
 * with arrows, switches and a checkbox.
 * @param props The scene colours.
 * @returns The scene.
 */
export function SettingsScene({ colors }: SceneProps) {
	return (
		<PhoneScreen colors={colors} background='list'>
			<div
				className='relative flex justify-center items-center h-11 shrink-0'
				style={{ color: colors('headerIcon') }}
			>
				<IconArrowLeft size={18} className='left-4 absolute' />
				<span className='font-bold text-[17px]' style={{ color: colors('heading') }}>
					Settings
				</span>
			</div>
			<div className='flex flex-col gap-4 px-4 pt-1 overflow-hidden'>
				<span
					className='flex items-center gap-2 px-3 rounded-xl h-10 text-[15px]'
					style={{
						background: colors('input'),
						boxShadow: `inset 0 0 0 1px ${colors('inputBorder')}`,
						color: colors('chatInputPlaceholder'),
					}}
				>
					<IconMagnifier size={16} />
					Search
				</span>
				<Group colors={colors} title='Account Settings'>
					<Row colors={colors} icon={IconUser} label='Account' first />
					<Row colors={colors} icon={IconShield} label='Content & Social' />
					<Row colors={colors} icon={IconLock} label='Data & Privacy' />
					<Row colors={colors} icon={IconMobile} label='Devices' />
				</Group>
				<Group colors={colors} title='Unbound'>
					<Row
						colors={colors}
						icon={IconPuzzlePiece}
						label='Plugins'
						subLabel='12 enabled'
						first
					/>
					<Row
						colors={colors}
						icon={IconPaintbrush}
						label='Themes'
						subLabel='Your new theme'
					/>
				</Group>
				<Group colors={colors} title='App Settings'>
					<Row colors={colors} icon={IconPalette} label='Appearance' first />
					<Row colors={colors} icon={IconBell} label='Push Notifications' trailing='on' />
					<Row
						colors={colors}
						icon={IconAccessibility}
						label='Reduce Motion'
						trailing='off'
					/>
					<Row
						colors={colors}
						icon={IconCheck}
						label='Show Link Previews'
						trailing='checked'
					/>
				</Group>
			</div>
		</PhoneScreen>
	);
}

export default { SettingsScene };
