import { cloneElement, isValidElement, type ReactNode } from 'react';
import { createLogger } from '@unbound-app/logger';

import {
	CHAT_CHANNEL_ID,
	needsSupportGate,
	SUPPORT_FORUM_ID,
	UNBOUND_GUILD_ID,
} from '~/core/support-gate';
import SupportGateContent from '~/ui/support-gate/support-gate-content';
import SupportBanner from '~/ui/support-gate/support-banner';
import { getSetting, setSetting } from '~/settings/unbound';
import { findByProps, findStore } from '~/metro/lookups';
import { createPatcher } from '~/patcher/create-patcher';
import { onModuleLoaded } from '~/metro/wait';
import { interceptAction } from '~/flux/api';
import { byFilePath } from '~/metro/filters';
import { showDialog } from '~/dialogs/api';
import { Users } from '~/metro/stores';
import { messages } from '~/i18n/api';
import { show } from '~/toasts/api';

const Patcher = createPatcher('unbound::support-gate');
const Logger = createLogger('SupportGate');

const GuildMembers = findStore('GuildMember');
const Router = findByProps('transitionToChannel');
const SelectedChannel = findStore('SelectedChannel');

type Member = { roles?: string[]; joinedAt?: string };

type ContainerProps = { channel?: { id?: string }; channelId?: string };

type ChannelAction = { channelId?: string };

type ParentProps = { children?: ReactNode };

const stops: (() => void)[] = [];
let gateOpen = false;

function isGated(): boolean {
	const userId = Users.getCurrentUser()?.id;
	const member = userId
		? (GuildMembers.getMember(UNBOUND_GUILD_ID, userId) as Member | undefined)
		: undefined;

	if (!userId || !member) {
		return false;
	}

	return needsSupportGate(
		{ userId, roles: member.roles ?? [], joinedAt: member.joinedAt },
		Date.now(),
	);
}

function accepted(): boolean {
	return getSetting('support-gate.accepted') === Users.getCurrentUser()?.id;
}

function openForum() {
	Router?.transitionToChannel?.(SUPPORT_FORUM_ID);
}

/**
 * @description Opens the support gate dialog unless it is already showing.
 */
export function openSupportGate(): void {
	if (gateOpen) return;

	gateOpen = true;
	showDialog({
		title: messages.UNBOUND_SUPPORT_GATE_TITLE,
		content: ({ dismiss }) => (
			<SupportGateContent
				dismiss={dismiss}
				onOpenForum={openForum}
				onAccept={() =>
					setSetting('support-gate.accepted', Users.getCurrentUser()?.id ?? '')
				}
			/>
		),
		cancel: messages.UNBOUND_SUPPORT_GATE_LATER,
		onCancel: () => {
			gateOpen = false;
		},
		onDismiss: () => {
			gateOpen = false;
		},
	});
}

function blocks(channelId: string | undefined): boolean {
	return channelId === CHAT_CHANNEL_ID && isGated() && !accepted();
}

function refuse() {
	show({ id: 'support-gate', title: messages.UNBOUND_SUPPORT_GATE_BLOCKED });
	openSupportGate();
}

function patchSending() {
	const Messages = findByProps('sendMessage', 'editMessage');

	if (!Messages) {
		Logger.warn('Sending is not gated: Discord moved sendMessage.');

		return;
	}

	Patcher.instead(Messages, 'sendMessage', ({ args, original, this: self }) => {
		if (!blocks(args[0] as string)) {
			return original.apply(self, args);
		}

		refuse();

		return Promise.resolve();
	});
}

function patchBanner(Container: MetroExport) {
	Patcher.react.after(Container, 'default', ({ props, result }) => {
		const { channel, channelId } = props as ContainerProps;
		const id = channel?.id ?? channelId ?? SelectedChannel.getChannelId();

		if (id !== CHAT_CHANNEL_ID || !isGated() || !isValidElement<ParentProps>(result)) {
			return result;
		}

		return cloneElement(
			result,
			{},
			<>
				<SupportBanner key='support-gate-banner' onOpenForum={openForum} />
				{result.props.children}
			</>,
		);
	});
}

/**
 * @description Keeps new members of Unbound's server from asking for help in its chat: before their first message
 * there a red notice they must read and answer explains that support lives in the forum, and a red banner above the
 * chat input keeps pointing there.
 */
export function start() {
	patchSending();
	stops.push(
		onModuleLoaded(
			byFilePath('modules/chat_input/native/FloatingChatInputContainer.tsx'),
			patchBanner,
		),
		interceptAction('CHANNEL_SELECT', (action) => {
			if (blocks((action as ChannelAction).channelId)) {
				setTimeout(openSupportGate, 0);
			}

			return false;
		}),
		interceptAction('UPLOAD_ATTACHMENT_ADD_FILES', (action) => {
			if (!blocks((action as ChannelAction).channelId)) {
				return false;
			}

			refuse();

			return true;
		}),
	);
}

/**
 * @description Removes the gate, the banner and the send block. Twin of {@link start}.
 */
export function stop() {
	for (const remove of stops.splice(0)) remove();

	Patcher.unpatchAll();
	gateOpen = false;
}

export default { start, stop };
