import {
	IconDotsVertical,
	IconEnvelope,
	IconPhone,
	IconUserPlus,
	IconVideo,
} from 'nucleo-micro-bold';
import type { ReactNode } from 'react';

import type { AvatarTone, SceneProps } from '~/components/theme-maker/scene-parts';
import { Avatar, PhoneScreen } from '~/components/theme-maker/scene-parts';
import type { SceneElement } from '~/lib/theme-maker/scene-tokens';

type SectionProps = SceneProps & {
	title: string;
	children: ReactNode;
};

const ROLES: { name: string; tone: SceneElement }[] = [
	{ name: 'Maintainer', tone: 'avatarBlurple' },
	{ name: 'Theme Maker', tone: 'avatarRed' },
	{ name: 'Beta Tester', tone: 'avatarGreen' },
	{ name: 'Night Owl', tone: 'avatarYellow' },
];

const MUTUALS: { initials: string; tone: AvatarTone }[] = [
	{ initials: 'UB', tone: 'blurple' },
	{ initials: 'GG', tone: 'green' },
	{ initials: 'LO', tone: 'yellow' },
];

const ACTIONS = [
	{ key: 'call', Icon: IconPhone },
	{ key: 'video', Icon: IconVideo },
	{ key: 'friend', Icon: IconUserPlus },
	{ key: 'more', Icon: IconDotsVertical },
];

function Section({ colors, title, children }: SectionProps) {
	return (
		<div
			className='flex flex-col gap-1.5 p-3 rounded-xl'
			style={{ background: colors('profileSection') }}
		>
			<span className='font-semibold text-[12px]' style={{ color: colors('profileHeading') }}>
				{title}
			</span>
			{children}
		</div>
	);
}

/**
 * @description A Discord mobile user profile sheet: banner, avatar with status, custom status, actions, about me,
 * member since and role pills, over the dimmed chat.
 * @param props The scene colours.
 * @returns The scene.
 */
export function ProfileScene({ colors }: SceneProps) {
	const secondary = {
		background: colors('secondaryButton'),
		color: colors('secondaryButtonText'),
	};

	return (
		<PhoneScreen colors={colors} background='chat'>
			<div className='absolute inset-0' style={{ background: colors('scrim') }} />
			<div
				className='relative flex flex-col flex-1 mt-6 rounded-t-[22px] overflow-hidden'
				style={{ background: colors('sheet') }}
			>
				<div className='h-24 shrink-0' style={{ background: colors('avatarBlurple') }} />
				<div className='flex justify-between items-end -mt-11 px-4'>
					<span
						className='rounded-full'
						style={{ boxShadow: `0 0 0 5px ${colors('sheet')}` }}
					>
						<Avatar
							colors={colors}
							initials='M'
							tone='yellow'
							size={80}
							status='idle'
							ring='sheet'
						/>
					</span>
					<span
						className='relative mb-1 px-3 py-2 rounded-2xl max-w-[170px] text-[13px]'
						style={{ background: colors('customStatus'), color: colors('textDefault') }}
					>
						🎨 making themes
					</span>
				</div>
				<div className='flex flex-col gap-3 px-4 pt-3 overflow-hidden'>
					<div className='flex flex-col gap-0.5'>
						<span
							className='font-bold text-[22px]'
							style={{ color: colors('textStrong') }}
						>
							Mira
						</span>
						<span className='text-[14px]' style={{ color: colors('textDefault') }}>
							mira.codes · she/her
						</span>
					</div>
					<div className='flex gap-2 h-10'>
						<span
							className='flex flex-1 justify-center items-center gap-1.5 rounded-xl font-semibold'
							style={{
								background: colors('primaryButton'),
								color: colors('primaryButtonText'),
							}}
						>
							<IconEnvelope size={16} />
							Message
						</span>
						{ACTIONS.map(({ key, Icon }) => (
							<span
								key={key}
								className='flex justify-center items-center rounded-xl w-10'
								style={secondary}
							>
								<Icon size={16} />
							</span>
						))}
					</div>
					<Section colors={colors} title='About Me'>
						<span className='text-[14px]' style={{ color: colors('textDefault') }}>
							Making Discord pretty, one palette at a time. Themes at{' '}
							<span style={{ color: colors('link') }}>unbound.rip</span>
						</span>
					</Section>
					<Section colors={colors} title='Member Since'>
						<span className='text-[14px]' style={{ color: colors('textDefault') }}>
							12 Mar 2019 · Unbound 4 Jan 2024
						</span>
					</Section>
					<Section colors={colors} title='Roles'>
						<div className='flex flex-wrap gap-1.5'>
							{ROLES.map((role) => (
								<span
									key={role.name}
									className='flex items-center gap-1.5 px-2 rounded-md h-6 font-medium text-[12px]'
									style={{
										background: colors('rolePill'),
										color: colors('rolePillText'),
									}}
								>
									<span
										className='rounded-full size-2.5'
										style={{ background: colors(role.tone) }}
									/>
									{role.name}
								</span>
							))}
						</div>
					</Section>
					<Section colors={colors} title='Mutual Servers'>
						<div className='flex items-center gap-2'>
							{MUTUALS.map((server) => (
								<Avatar
									key={server.initials}
									colors={colors}
									size={28}
									square
									{...server}
								/>
							))}
							<span className='text-[13px]' style={{ color: colors('textMuted') }}>
								and 4 more
							</span>
						</div>
					</Section>
				</div>
			</div>
		</PhoneScreen>
	);
}

export default { ProfileScene };
