import {
	IconBell,
	IconChevronDown,
	IconMagnifier,
	IconPlus,
	IconUserPlus,
} from 'nucleo-micro-bold';

import type { AvatarTone, SceneProps, Status } from '~/components/theme-maker/scene-parts';
import { Avatar, Badge, PhoneScreen, Rail } from '~/components/theme-maker/scene-parts';

type Conversation = {
	name: string;
	tone: AvatarTone;
	status?: Status;
	preview: string;
	time: string;
	unread?: number;
	/** A group DM stacks a second avatar. */
	group?: AvatarTone;
	app?: boolean;
};

type ConversationRowProps = SceneProps & {
	conversation: Conversation;
};

const ACTIVE: { initials: string; tone: AvatarTone; status: Status }[] = [
	{ initials: 'M', tone: 'blurple', status: 'idle' },
	{ initials: 'J', tone: 'green', status: 'online' },
	{ initials: 'T', tone: 'grey', status: 'online' },
	{ initials: 'S', tone: 'red', status: 'dnd' },
];

const CONVERSATIONS: Conversation[] = [
	{
		name: 'Mira',
		tone: 'blurple',
		status: 'idle',
		preview: 'ok see you at 8!',
		time: '2m',
		unread: 2,
	},
	{
		name: 'Weekend Crew',
		tone: 'green',
		group: 'yellow',
		preview: 'Theo: who is bringing snacks',
		time: '14m',
		unread: 5,
	},
	{
		name: 'Juniper',
		tone: 'green',
		status: 'online',
		preview: 'lol that is exactly what happened',
		time: '1h',
	},
	{
		name: 'Ollie',
		tone: 'yellow',
		status: 'dnd',
		preview: 'You: sounds good, send it over',
		time: '3h',
	},
	{
		name: 'Carl-bot',
		tone: 'grey',
		preview: 'Reminder: water the plants 🌱',
		time: '2d',
		app: true,
	},
	{
		name: 'Sage',
		tone: 'red',
		status: 'offline',
		preview: 'congrats on the release!! 🎉',
		time: '5d',
	},
	{ name: 'Wren', tone: 'blurple', status: 'online', preview: 'You: night!', time: '1w' },
];

function ActionBar({ colors }: SceneProps) {
	const secondary = {
		background: colors('secondaryButton'),
		color: colors('secondaryButtonText'),
	};

	return (
		<div className='flex gap-2 h-9'>
			<span className='flex justify-center items-center rounded-xl w-10' style={secondary}>
				<IconMagnifier size={16} />
			</span>
			<span
				className='flex flex-1 justify-center items-center gap-1.5 rounded-xl font-semibold'
				style={secondary}
			>
				<IconUserPlus size={16} />
				Add Friends
			</span>
			<span
				className='flex justify-center items-center rounded-xl w-10'
				style={{ background: colors('primaryButton'), color: colors('primaryButtonText') }}
			>
				<IconPlus size={18} />
			</span>
		</div>
	);
}

function ConversationAvatar({ colors, conversation }: ConversationRowProps) {
	if (conversation.group) {
		return (
			<span className='relative size-10 shrink-0'>
				<span className='top-0 left-0 absolute'>
					<Avatar colors={colors} initials='T' tone={conversation.group} size={26} />
				</span>
				<span
					className='right-0 bottom-0 absolute rounded-full'
					style={{ boxShadow: `0 0 0 2px ${colors('list')}` }}
				>
					<Avatar colors={colors} initials='W' tone={conversation.tone} size={26} />
				</span>
			</span>
		);
	}

	return (
		<Avatar
			colors={colors}
			initials={conversation.name.slice(0, 1)}
			tone={conversation.tone}
			size={40}
			status={conversation.status}
		/>
	);
}

function ConversationRow({ colors, conversation }: ConversationRowProps) {
	const unread = Boolean(conversation.unread);

	return (
		<div className='flex items-center gap-3 py-[7px]'>
			<ConversationAvatar colors={colors} conversation={conversation} />
			<div className='flex flex-col flex-1 gap-0.5 min-w-0'>
				<span className='flex items-center gap-1.5'>
					<span
						className='text-[15px] truncate'
						style={{ color: colors('textStrong'), fontWeight: unread ? 700 : 500 }}
					>
						{conversation.name}
					</span>
					{conversation.app ? (
						<span
							className='px-1 rounded font-bold text-[9px] leading-[14px]'
							style={{ background: colors('appTag'), color: colors('appTagText') }}
						>
							APP
						</span>
					) : null}
				</span>
				<span
					className='text-[13px] truncate'
					style={{
						color: colors(unread ? 'textDefault' : 'textMuted'),
						fontWeight: unread ? 600 : 400,
					}}
				>
					{conversation.preview}
				</span>
			</div>
			<span className='flex flex-col items-end gap-1 shrink-0'>
				<span className='font-semibold text-[11px]' style={{ color: colors('textMuted') }}>
					{conversation.time}
				</span>
				{conversation.unread ? <Badge colors={colors} count={conversation.unread} /> : null}
			</span>
		</div>
	);
}

function FloatingBar({ colors }: SceneProps) {
	return (
		<div
			className='right-3 bottom-4 left-3 absolute flex items-center gap-3 p-2 pr-3 rounded-2xl'
			style={{
				background: colors('floatingBar'),
				boxShadow: `inset 0 0 0 1px ${colors('floatingBarBorder')}`,
			}}
		>
			<Avatar
				colors={colors}
				initials='Y'
				tone='blurple'
				size={40}
				status='dnd'
				ring='floatingBar'
			/>
			<div className='flex flex-col flex-1 gap-0.5 min-w-0'>
				<span
					className='flex items-center gap-1 font-semibold text-[15px]'
					style={{ color: colors('textStrong') }}
				>
					you
					<IconChevronDown size={12} />
				</span>
				<span className='text-[12px]' style={{ color: colors('statusText') }}>
					Do Not Disturb
				</span>
			</div>
			<span
				className='flex items-center gap-1.5 px-2.5 rounded-xl h-9'
				style={{ background: colors('secondaryButton'), color: colors('iconDefault') }}
			>
				<IconBell size={16} />
				<Badge colors={colors} count={7} />
			</span>
		</div>
	);
}

/**
 * @description Discord's mobile home: the server rail, the DM list with unread counts, and the floating "you" bar.
 * @param props The scene colours.
 * @returns The scene.
 */
export function HomeScene({ colors }: SceneProps) {
	return (
		<PhoneScreen colors={colors} background='rail'>
			<div className='flex flex-1 min-h-0'>
				<Rail colors={colors} selected='DM' />
				<div
					className='flex flex-col flex-1 gap-3 px-3 pt-2 rounded-tl-[22px] min-w-0'
					style={{ background: colors('list') }}
				>
					<span className='font-bold text-[20px]' style={{ color: colors('heading') }}>
						Messages
					</span>
					<ActionBar colors={colors} />
					<div className='flex gap-2 -mr-3 overflow-hidden'>
						{ACTIVE.map((person) => (
							<span
								key={person.initials}
								className='flex justify-center items-center rounded-2xl w-[64px] h-[64px] shrink-0'
								style={{ background: colors('avatarCard') }}
							>
								<Avatar colors={colors} size={40} ring='avatarCard' {...person} />
							</span>
						))}
					</div>
					<div className='flex flex-col'>
						{CONVERSATIONS.map((conversation) => (
							<ConversationRow
								key={conversation.name}
								colors={colors}
								conversation={conversation}
							/>
						))}
					</div>
				</div>
			</div>
			<FloatingBar colors={colors} />
		</PhoneScreen>
	);
}

export default { HomeScene };
