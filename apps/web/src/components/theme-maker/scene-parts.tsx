import { IconPlus } from 'nucleo-micro-bold';
import type { ReactNode } from 'react';

import type { SceneColors, SceneElement } from '~/lib/theme-maker/scene-tokens';
import cn from '~/lib/cn';

export type Status = 'online' | 'idle' | 'dnd' | 'offline';

export type AvatarTone = 'blurple' | 'green' | 'yellow' | 'red' | 'grey';

export type SceneProps = {
	colors: SceneColors;
};

type AvatarProps = SceneProps & {
	initials: string;
	tone: AvatarTone;
	size?: number;
	/** Discord's server icons are rounded squares rather than circles. */
	square?: boolean;
	status?: Status;
	/** The colour behind the avatar, which the status dot's ring cuts into. */
	ring?: SceneElement;
	/** Draws the green ring Discord puts round a speaking voice user. */
	speaking?: boolean;
};

type BadgeProps = SceneProps & {
	count: number;
	ring?: SceneElement;
};

type RailProps = SceneProps & {
	/** Which icon the selected pill sits on: the DM button, or a server by initials. */
	selected: string;
};

type PhoneScreenProps = SceneProps & {
	background: SceneElement;
	children: ReactNode;
};

type RailServer = {
	initials: string;
	tone: AvatarTone;
	unread?: boolean;
	mentions?: number;
};

const AVATAR_TONES: Record<AvatarTone, SceneElement> = {
	blurple: 'avatarBlurple',
	green: 'avatarGreen',
	yellow: 'avatarYellow',
	red: 'avatarRed',
	grey: 'avatarGrey',
};

const STATUS_TONES: Record<Status, SceneElement> = {
	online: 'statusOnline',
	idle: 'statusIdle',
	dnd: 'statusDnd',
	offline: 'statusOffline',
};

const RAIL_SERVERS: RailServer[] = [
	{ initials: 'UB', tone: 'blurple', mentions: 3 },
	{ initials: 'PX', tone: 'red', unread: true },
	{ initials: 'GG', tone: 'green' },
	{ initials: 'LO', tone: 'yellow', unread: true },
];

/**
 * @description A placeholder avatar: a coloured circle with initials and an optional status dot.
 * @param props The scene colours, the initials, the tone, the size and the status.
 * @returns The avatar.
 */
export function Avatar({
	colors,
	initials,
	tone,
	size = 36,
	square = false,
	status,
	ring = 'list',
	speaking = false,
}: AvatarProps) {
	const dot = Math.round(size * 0.36);

	return (
		<span className='relative inline-flex shrink-0' style={{ width: size, height: size }}>
			<span
				className={cn(
					'flex justify-center items-center size-full font-semibold select-none',
					square ? 'rounded-[30%]' : 'rounded-full',
				)}
				style={{
					background: colors(AVATAR_TONES[tone]),
					color: colors('avatarText'),
					fontSize: size * 0.38,
					boxShadow: speaking
						? `0 0 0 2px ${colors(ring)}, 0 0 0 4px ${colors('speaking')}`
						: undefined,
				}}
			>
				{initials}
			</span>
			{status ? (
				<span
					className='-right-0.5 -bottom-0.5 absolute rounded-full'
					style={{
						width: dot,
						height: dot,
						background: colors(STATUS_TONES[status]),
						boxShadow: `0 0 0 2.5px ${colors(ring)}`,
					}}
				/>
			) : null}
		</span>
	);
}

/**
 * @description Discord's red notification count.
 * @param props The scene colours, the count and the colour its ring cuts into.
 * @returns The badge.
 */
export function Badge({ colors, count, ring }: BadgeProps) {
	return (
		<span
			className='flex justify-center items-center px-1 rounded-full min-w-4 h-4 font-bold text-[10px] leading-none'
			style={{
				background: colors('badge'),
				color: colors('badgeText'),
				boxShadow: ring ? `0 0 0 3px ${colors(ring)}` : undefined,
			}}
		>
			{count}
		</span>
	);
}

/**
 * @description The server rail: the DM button, servers with unread pills and mention badges, a folder and "add".
 * @param props The scene colours and the selected icon.
 * @returns The rail.
 */
export function Rail({ colors, selected }: RailProps) {
	const pill = (height: number) => (
		<span
			className='top-1/2 -left-[13px] absolute rounded-r-full w-1 -translate-y-1/2'
			style={{ height, background: colors('railPill') }}
		/>
	);

	return (
		<div className='flex flex-col items-center gap-2 pt-2 w-[64px] shrink-0'>
			<div className='relative'>
				{selected === 'DM' ? pill(36) : null}
				<Avatar colors={colors} initials='DM' tone='blurple' size={44} square ring='rail' />
			</div>
			<span className='w-8 h-px' style={{ background: colors('divider') }} />
			{RAIL_SERVERS.map((server) => (
				<div key={server.initials} className='relative'>
					{selected === server.initials ? pill(36) : server.unread ? pill(8) : null}
					<Avatar
						colors={colors}
						initials={server.initials}
						tone={server.tone}
						size={44}
						square
						ring='rail'
					/>
					{server.mentions ? (
						<span className='-right-1 -bottom-1 absolute'>
							<Badge colors={colors} count={server.mentions} ring='rail' />
						</span>
					) : null}
				</div>
			))}
			<span
				className='flex flex-col items-center gap-1 p-1 rounded-2xl'
				style={{ background: colors('railFolder') }}
			>
				<Avatar colors={colors} initials='AR' tone='grey' size={36} square ring='rail' />
				<Avatar colors={colors} initials='MC' tone='green' size={36} square ring='rail' />
			</span>
			<span
				className='flex justify-center items-center rounded-full size-11'
				style={{ background: colors('railIcon'), color: colors('railIconGlyph') }}
			>
				<IconPlus size={20} />
			</span>
		</div>
	);
}

/**
 * @description A phone-sized screen with a status bar, which clips the scene inside it.
 * @param props The scene colours, the element behind the status bar, and the scene.
 * @returns The screen.
 */
export function PhoneScreen({ colors, background, children }: PhoneScreenProps) {
	const foreground = colors('headerIcon');

	// The status bar is the phone's, so only its tint follows the theme.
	return (
		<div
			className='relative flex flex-col mx-auto rounded-lg ring-1 ring-border w-full max-w-[360px] h-[680px] overflow-hidden text-[14px] leading-tight select-none'
			style={{ background: colors(background) }}
		>
			<div
				className='flex justify-between items-center px-6 pt-2 h-9 font-semibold text-[14px] shrink-0'
				style={{ color: foreground }}
			>
				<span>9:41</span>
				<span
					className='border-2 rounded-[5px] w-6 h-3'
					style={{ borderColor: foreground }}
				/>
			</div>
			{children}
		</div>
	);
}

export default { Avatar, Badge, Rail, PhoneScreen };
