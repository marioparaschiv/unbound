import {
	IconArrowLeft,
	IconChevronRight,
	IconFaceSmile,
	IconGift,
	IconHashtag,
	IconMagnifier,
	IconMicrophone,
	IconPlus,
	IconUsers,
} from 'nucleo-micro-bold';
import type { ReactNode } from 'react';

import type { AvatarTone, SceneProps } from '~/components/theme-maker/scene-parts';
import { Avatar, PhoneScreen } from '~/components/theme-maker/scene-parts';

type MessageProps = SceneProps & {
	author: string;
	tone: AvatarTone;
	time: string;
	children: ReactNode;
};

type ReactionProps = SceneProps & {
	emoji: string;
	count: number;
	reacted: boolean;
};

type ReplyProps = SceneProps & {
	author: string;
	tone: AvatarTone;
	text: string;
};

function Header({ colors }: SceneProps) {
	return (
		<div
			className='flex items-center gap-3 px-4 pb-2 h-11 shrink-0'
			style={{
				color: colors('headerIcon'),
				boxShadow: `inset 0 -1px 0 ${colors('headerBorder')}`,
			}}
		>
			<IconArrowLeft size={18} />
			<span
				className='flex flex-1 items-center gap-1 font-semibold text-[16px]'
				style={{ color: colors('textStrong') }}
			>
				<IconHashtag size={16} style={{ color: colors('channelIcon') }} />
				general
				<IconChevronRight size={11} style={{ color: colors('iconMuted') }} />
			</span>
			<IconMagnifier size={18} />
			<IconUsers size={18} />
		</div>
	);
}

function Reply({ colors, author, tone, text }: ReplyProps) {
	return (
		<div className='flex items-center gap-1.5 pl-[30px] -mb-0.5 text-[13px]'>
			<span
				className='mt-2 border-t-2 border-l-2 rounded-tl-md w-6 h-2.5 shrink-0'
				style={{ borderColor: colors('replySpine') }}
			/>
			<Avatar colors={colors} initials={author.slice(0, 1)} tone={tone} size={16} />
			<span className='font-semibold shrink-0' style={{ color: colors('textStrong') }}>
				{author}
			</span>
			<span className='truncate' style={{ color: colors('textMuted') }}>
				{text}
			</span>
		</div>
	);
}

function Message({ colors, author, tone, time, children }: MessageProps) {
	return (
		<div className='flex gap-3 px-4 py-1.5'>
			<Avatar colors={colors} initials={author.slice(0, 1)} tone={tone} size={36} />
			<div className='flex flex-col flex-1 gap-1.5 min-w-0'>
				<span className='flex items-baseline gap-2'>
					<span
						className='font-semibold text-[15px]'
						style={{ color: colors('textStrong') }}
					>
						{author}
					</span>
					<span className='text-[11px]' style={{ color: colors('textMuted') }}>
						{time}
					</span>
				</span>
				<div
					className='flex flex-col gap-2 text-[15px]'
					style={{ color: colors('textDefault') }}
				>
					{children}
				</div>
			</div>
		</div>
	);
}

function Embed({ colors }: SceneProps) {
	return (
		// The card is rounded and clips a straight rail on its left edge, as Discord draws it; a rounded border would bend the rail.
		<div
			className='flex border rounded-md overflow-hidden'
			style={{ background: colors('embed'), borderColor: colors('embedBorder') }}
		>
			<span className='w-1 shrink-0' style={{ background: colors('avatarBlurple') }} />
			<div className='flex flex-col flex-1 gap-1 p-3 min-w-0'>
				<span className='text-[12px]' style={{ color: colors('textMuted') }}>
					unbound.rip
				</span>
				<span className='font-semibold text-[14px]' style={{ color: colors('link') }}>
					Create a Theme · Unbound
				</span>
				<span className='text-[13px]' style={{ color: colors('textDefault') }}>
					Pick three colors, see them on Discord, and download a theme you can submit.
				</span>
			</div>
		</div>
	);
}

function Reaction({ colors, emoji, count, reacted }: ReactionProps) {
	return (
		<span
			className='flex items-center gap-1.5 px-2 rounded-lg h-7 font-semibold text-[13px]'
			style={{
				background: colors(reacted ? 'reactionReacted' : 'reaction'),
				boxShadow: `inset 0 0 0 1px ${colors(reacted ? 'reactionReactedBorder' : 'reactionBorder')}`,
				color: colors(reacted ? 'reactionReactedText' : 'reactionText'),
			}}
		>
			<span className='text-[14px]'>{emoji}</span>
			{count}
		</span>
	);
}

function NewDivider({ colors }: SceneProps) {
	return (
		<div className='flex items-center px-4 py-1.5'>
			<span className='flex-1 h-px' style={{ background: colors('newDivider') }} />
			<span
				className='px-1.5 rounded font-bold text-[10px] leading-4'
				style={{ background: colors('newDividerText'), color: colors('chat') }}
			>
				NEW
			</span>
		</div>
	);
}

function ChatInput({ colors }: SceneProps) {
	return (
		<div className='flex items-center gap-2 px-3 pt-1 pb-6 shrink-0'>
			<span
				className='flex justify-center items-center rounded-full size-10 shrink-0'
				style={{ background: colors('chatInput'), color: colors('chatInputIcon') }}
			>
				<IconPlus size={18} />
			</span>
			<span
				className='flex justify-center items-center rounded-full size-10 shrink-0'
				style={{ background: colors('chatInput'), color: colors('chatInputIcon') }}
			>
				<IconGift size={17} />
			</span>
			<span
				className='flex flex-1 items-center gap-3 px-4 rounded-full h-10 min-w-0'
				style={{
					background: colors('chatInput'),
					boxShadow: `inset 0 0 0 1px ${colors('chatInputBorder')}`,
					color: colors('chatInputIcon'),
				}}
			>
				<span
					className='flex-1 text-[15px] truncate'
					style={{ color: colors('chatInputPlaceholder') }}
				>
					Message #general
				</span>
				<IconFaceSmile size={18} />
				<IconMicrophone size={18} />
			</span>
		</div>
	);
}

/**
 * @description Discord's mobile chat in a server channel: a reply, a link embed, inline code, reactions, the "new"
 * divider, a message that mentions you, the typing indicator and the chat input.
 * @param props The scene colours.
 * @returns The scene.
 */
export function ChatScene({ colors }: SceneProps) {
	return (
		<PhoneScreen colors={colors} background='chat'>
			<Header colors={colors} />
			<div className='flex flex-col flex-1 justify-end py-1 min-h-0 overflow-hidden'>
				<Message colors={colors} author='Juniper' tone='green' time='Today at 18:02'>
					<span>has anyone tried the new theme maker yet?</span>
				</Message>
				<Reply
					colors={colors}
					author='Juniper'
					tone='green'
					text='has anyone tried the new theme maker yet?'
				/>
				<Message colors={colors} author='Mira' tone='blurple' time='Today at 18:04'>
					<span>
						yes! made a pink one in two minutes{' '}
						<span style={{ color: colors('link') }}>unbound.rip/themes/create</span>
					</span>
					<Embed colors={colors} />
					<div className='flex gap-1.5'>
						<Reaction colors={colors} emoji='💜' count={4} reacted />
						<Reaction colors={colors} emoji='👀' count={2} reacted={false} />
					</div>
				</Message>
				<Message colors={colors} author='Theo' tone='grey' time='Today at 18:05'>
					<span>
						and{' '}
						<span
							className='px-1 rounded font-mono text-[13px]'
							style={{ background: colors('code'), color: colors('codeText') }}
						>
							ubd dev
						</span>{' '}
						reloads it on the phone as you save
					</span>
				</Message>
				<NewDivider colors={colors} />
				<div
					style={{
						background: colors('mentionedRow'),
						boxShadow: `inset 2px 0 0 ${colors('mentionedGutter')}`,
					}}
				>
					<Message colors={colors} author='Ollie' tone='yellow' time='Today at 18:07'>
						<span>
							<span
								className='px-0.5 rounded font-medium'
								style={{
									background: colors('mention'),
									color: colors('mentionText'),
								}}
							>
								@you
							</span>{' '}
							can you try it on midnight tonight?
						</span>
					</Message>
				</div>
			</div>
			<div
				className='flex items-center gap-1.5 px-4 h-6 text-[12px] shrink-0'
				style={{ background: colors('typing'), color: colors('textDefault') }}
			>
				<span className='flex gap-0.5'>
					{[0, 1, 2].map((dot) => (
						<span
							key={dot}
							className='rounded-full size-1'
							style={{ background: colors('iconDefault') }}
						/>
					))}
				</span>
				<span>
					<span className='font-semibold'>Sage</span> is typing…
				</span>
			</div>
			<ChatInput colors={colors} />
		</PhoneScreen>
	);
}

export default { ChatScene };
