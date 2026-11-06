import {
	IconCalendar,
	IconChevronDown,
	IconChevronRight,
	IconHashtag,
	IconMagnifier,
	IconMicrophone,
	IconUserPlus,
	IconVolume,
} from 'nucleo-micro-bold';

import { Avatar, Badge, PhoneScreen, Rail } from '~/components/theme-maker/scene-parts';
import type { AvatarTone, SceneProps } from '~/components/theme-maker/scene-parts';

type ChannelState = 'read' | 'unread' | 'muted' | 'selected';

type Channel = {
	name: string;
	state: ChannelState;
	mentions?: number;
};

type ChannelRowProps = SceneProps & Channel;

type CategoryProps = SceneProps & {
	name: string;
};

type VoiceUserProps = SceneProps & {
	name: string;
	tone: AvatarTone;
	speaking?: boolean;
	muted?: boolean;
};

const NAME_COLORS = {
	read: 'channelName',
	unread: 'channelNameUnread',
	muted: 'channelNameMuted',
	selected: 'channelSelectedText',
} as const;

const TOP_CHANNELS: Channel[] = [
	{ name: 'welcome', state: 'read' },
	{ name: 'announcements', state: 'unread' },
];

const TEXT_CHANNELS: Channel[] = [
	{ name: 'general', state: 'selected' },
	{ name: 'support', state: 'unread', mentions: 2 },
	{ name: 'themes', state: 'unread' },
	{ name: 'plugin-dev', state: 'read' },
	{ name: 'off-topic', state: 'muted' },
];

function ChannelRow({ colors, name, state, mentions }: ChannelRowProps) {
	return (
		<div
			className='relative flex items-center gap-2 px-2 rounded-lg h-9'
			style={{ background: state === 'selected' ? colors('channelSelected') : undefined }}
		>
			{state === 'unread' ? (
				<span
					className='top-1/2 -left-3 absolute rounded-r-full w-1 h-2 -translate-y-1/2'
					style={{ background: colors('railPill') }}
				/>
			) : null}
			<IconHashtag
				size={16}
				style={{ color: colors(state === 'muted' ? 'channelNameMuted' : 'channelIcon') }}
			/>
			<span
				className='flex-1 text-[15px] truncate'
				style={{
					color: colors(NAME_COLORS[state]),
					fontWeight: state === 'unread' || state === 'selected' ? 600 : 500,
				}}
			>
				{name}
			</span>
			{mentions ? <Badge colors={colors} count={mentions} /> : null}
		</div>
	);
}

function Category({ colors, name }: CategoryProps) {
	return (
		<div
			className='flex items-center gap-1 pt-3 pb-1 font-semibold text-[12px] uppercase tracking-wide'
			style={{ color: colors('textMuted') }}
		>
			<IconChevronDown size={10} />
			{name}
		</div>
	);
}

function VoiceUser({ colors, name, tone, speaking = false, muted = false }: VoiceUserProps) {
	return (
		<div className='flex items-center gap-2 pl-8 h-8'>
			<Avatar
				colors={colors}
				initials={name.slice(0, 1)}
				tone={tone}
				size={22}
				speaking={speaking}
			/>
			<span
				className='flex-1 text-[14px]'
				style={{ color: colors(speaking ? 'textStrong' : 'textDefault') }}
			>
				{name}
			</span>
			{muted ? <IconMicrophone size={13} style={{ color: colors('voiceMuted') }} /> : null}
		</div>
	);
}

/**
 * @description A Discord mobile server: the rail, then the channel list with categories, unread and mention badges,
 * a muted channel and a voice channel with users in it.
 * @param props The scene colours.
 * @returns The scene.
 */
export function ServerScene({ colors }: SceneProps) {
	const secondary = {
		background: colors('secondaryButton'),
		color: colors('secondaryButtonText'),
	};

	return (
		<PhoneScreen colors={colors} background='rail'>
			<div className='flex flex-1 min-h-0'>
				<Rail colors={colors} selected='UB' />
				<div
					className='flex flex-col flex-1 px-3 pt-3 rounded-tl-[22px] min-w-0'
					style={{ background: colors('list') }}
				>
					<span
						className='flex items-center gap-1 font-bold text-[18px]'
						style={{ color: colors('heading') }}
					>
						Unbound
						<IconChevronRight size={12} />
					</span>
					<span
						className='flex items-center gap-1.5 mt-1 text-[12px]'
						style={{ color: colors('textMuted') }}
					>
						<span
							className='rounded-full size-2'
							style={{ background: colors('statusOnline') }}
						/>
						312 Online
						<span
							className='rounded-full size-2'
							style={{ background: colors('statusOffline') }}
						/>
						1,284 Members
					</span>
					<div className='flex gap-2 mt-3 h-9'>
						<span
							className='flex flex-1 items-center gap-1.5 px-3 rounded-xl'
							style={secondary}
						>
							<IconMagnifier size={15} />
							Search
						</span>
						<span
							className='flex justify-center items-center rounded-xl w-10'
							style={secondary}
						>
							<IconUserPlus size={16} />
						</span>
						<span
							className='flex justify-center items-center rounded-xl w-10'
							style={secondary}
						>
							<IconCalendar size={16} />
						</span>
					</div>
					<div className='flex flex-col mt-2'>
						{TOP_CHANNELS.map((channel) => (
							<ChannelRow key={channel.name} colors={colors} {...channel} />
						))}
						<Category colors={colors} name='Text Channels' />
						{TEXT_CHANNELS.map((channel) => (
							<ChannelRow key={channel.name} colors={colors} {...channel} />
						))}
						<Category colors={colors} name='Voice Channels' />
						<div className='flex items-center gap-2 px-2 h-9'>
							<IconVolume size={16} style={{ color: colors('channelIcon') }} />
							<span
								className='flex-1 font-medium text-[15px]'
								style={{ color: colors('channelName') }}
							>
								Lounge
							</span>
						</div>
						<VoiceUser colors={colors} name='Mira' tone='blurple' speaking />
						<VoiceUser colors={colors} name='Theo' tone='grey' muted />
						<div className='flex items-center gap-2 px-2 h-9'>
							<IconVolume size={16} style={{ color: colors('channelIcon') }} />
							<span
								className='flex-1 font-medium text-[15px]'
								style={{ color: colors('channelName') }}
							>
								Gaming
							</span>
						</div>
					</div>
				</div>
			</div>
		</PhoneScreen>
	);
}

export default { ServerScene };
