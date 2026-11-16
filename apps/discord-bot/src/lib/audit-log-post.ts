import { AuditLogEvent, type AuditLogChange, type GuildAuditLogsActionType } from 'discord.js';

import { describeChanges, describePermissionChanges } from '~/lib/log-changes';
import { field, fieldBelow, person } from '~/lib/post-fields';
import { auditCaseOf } from '~/lib/audit-cases';
import type { LogEntry } from '~/lib/log-post';
import { truncate } from '~/lib/message-text';
import { COLOURS } from '~/lib/constants';

/** The parts of a Discord audit log entry its misc log post shows. */
export type AuditLogFacts = {
	action: AuditLogEvent;
	actionType: GuildAuditLogsActionType;
	/** What the action was taken on, e.g. `Channel`, `Role` or `User`. */
	targetType: string;
	targetId: string | null;
	executorId: string | null;
	reason: string | null;
	changes: readonly AuditLogChange[];
	/** The channel a move, pin or unpin happened in. */
	channelId?: string;
};

// Message deletes post to the message logs; bans, kicks and timeouts post as cases.
const SKIPPED = new Set([AuditLogEvent.MessageDelete, AuditLogEvent.MessageBulkDelete]);

const TITLES: Partial<Record<AuditLogEvent, string>> = {
	[AuditLogEvent.MemberRoleUpdate]: 'Member Roles Updated',
	[AuditLogEvent.ChannelOverwriteCreate]: 'Channel Permissions Added',
	[AuditLogEvent.ChannelOverwriteUpdate]: 'Channel Permissions Updated',
	[AuditLogEvent.ChannelOverwriteDelete]: 'Channel Permissions Removed',
	[AuditLogEvent.AutoModerationBlockMessage]: 'AutoMod Blocked a Message',
	[AuditLogEvent.AutoModerationFlagToChannel]: 'AutoMod Flagged a Message',
	[AuditLogEvent.AutoModerationUserCommunicationDisabled]: 'AutoMod Timed Out a Member',
	[AuditLogEvent.AutoModerationQuarantineUser]: 'AutoMod Quarantined a Member',
};

const PAST: Readonly<Record<string, string>> = {
	Create: 'Created',
	Update: 'Updated',
	Delete: 'Deleted',
	Add: 'Added',
	Remove: 'Removed',
	Move: 'Moved',
	Disconnect: 'Disconnected',
	Prune: 'Pruned',
	Pin: 'Pinned',
	Unpin: 'Unpinned',
};

const PERMISSION_LABELS: Readonly<Record<string, string>> = {
	permissions: 'Permissions',
	allow: 'Allowed permissions',
	deny: 'Denied permissions',
};

const CHANNEL_KEYS = new Set(['channel_id', 'parent_id', 'rules_channel_id', 'system_channel_id']);
const CHANGES_LIMIT = 2000;
const VALUE_LIMIT = 200;

/**
 * @description Titles an audit log action in title case, e.g. `ChannelCreate` as `Channel Created`.
 * @param action The action.
 * @returns The title.
 */
export function auditTitle(action: AuditLogEvent): string {
	const named = TITLES[action];

	if (named) {
		return named;
	}

	const words = (AuditLogEvent[action] ?? `Action ${action}`).split(/(?<=[a-z])(?=[A-Z])/);
	const verb = words.pop() ?? '';

	words.push(PAST[verb] ?? verb);

	return words.join(' ').replace('Auto Moderation', 'AutoMod').replace('Guild', 'Server');
}

const LABELS: Readonly<Record<string, string>> = {
	parent_id: 'Category',
	rate_limit_per_user: 'Slowmode',
	nsfw: 'NSFW',
	color: 'Colour',
};

function labelOf(key: string) {
	return (
		LABELS[key] ??
		key
			.replace(/^\$/, '')
			.split('_')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ')
	);
}

function isNamed(value: unknown): value is { id: string } {
	return (
		typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string'
	);
}

// UNKNOWN: an audit change value is whatever the changed setting holds: text, a number, a flag or an object.
function shown(key: string, value: unknown): string | undefined {
	if (value === undefined || value === null || value === '') return;

	if (CHANNEL_KEYS.has(key) && typeof value === 'string') {
		return `<#${value}>`;
	}

	if (key === 'color' && typeof value === 'number') {
		return `#${value.toString(16).padStart(6, '0')}`;
	}

	if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
		return String(value);
	}

	return truncate(JSON.stringify(value), VALUE_LIMIT);
}

// UNKNOWN: `$add` and `$remove` hold the roles given or taken, typed loosely by discord.js.
function roleList(value: unknown) {
	return Array.isArray(value) ? value.filter(isNamed).map(({ id }) => `<@&${id}>`) : [];
}

/**
 * @description Lists what an audit log entry changed: roles given or taken, permissions, then every other setting.
 * @param changes The entry's changes.
 * @returns One Markdown line per change.
 */
export function describeAuditChanges(changes: readonly AuditLogChange[]): string[] {
	const lines: string[] = [];
	const before: Record<string, string | undefined> = {};
	const after: Record<string, string | undefined> = {};

	for (const { key, old: previous, new: next } of changes) {
		if (key === '$add' || key === '$remove') {
			const roles = roleList(next);

			if (roles.length) {
				lines.push(
					field(key === '$add' ? 'Roles added' : 'Roles removed', roles.join(' ')),
				);
			}

			continue;
		}

		const permissionLabel = PERMISSION_LABELS[key];

		if (permissionLabel) {
			const changed = describePermissionChanges(
				BigInt(typeof previous === 'string' ? previous : 0),
				BigInt(typeof next === 'string' ? next : 0),
			);

			lines.push(...changed.map((line) => line.replace('Permissions', permissionLabel)));
			continue;
		}

		before[labelOf(key)] = shown(key, previous);
		after[labelOf(key)] = shown(key, next);
	}

	return [...lines, ...describeChanges(before, after)];
}

function target(targetType: string, id: string) {
	switch (targetType) {
		case 'Channel':
		case 'Thread':
			return `<#${id}>`;
		case 'Role':
			return `<@&${id}>`;
		default:
			return `\`${id}\``;
	}
}

function colourOf(actionType: GuildAuditLogsActionType) {
	if (actionType === 'Create') {
		return COLOURS.positive;
	}

	return actionType === 'Delete' ? COLOURS.danger : COLOURS.info;
}

function iconOf(actionType: GuildAuditLogsActionType) {
	if (actionType === 'Create') {
		return 'auditCreated';
	}

	return actionType === 'Delete' ? 'auditDeleted' : 'auditUpdated';
}

/**
 * @description Renders an audit log entry as a misc log post naming who did it; bans, kicks, timeouts and message deletes are left to their own logs.
 * @param facts The entry.
 * @returns The log entry, or undefined for an action logged elsewhere.
 */
export function auditLogEntry(facts: AuditLogFacts): LogEntry | undefined {
	const { action, actionType, targetType, targetId, executorId, reason, changes, channelId } =
		facts;

	if (SKIPPED.has(action) || auditCaseOf({ action, changes })) return;

	const isUser = targetType === 'User' && targetId;
	const changed = describeAuditChanges(changes);

	return {
		kind: 'misc',
		title: auditTitle(action),
		icon: iconOf(actionType),
		colour: colourOf(actionType),
		user: isUser ? { id: targetId, name: targetId } : undefined,
		lines: [
			targetId && !isUser && targetType !== 'Guild'
				? field(targetType, target(targetType, targetId))
				: '',
			field('By', executorId ? person(executorId) : '*Unknown*'),
			channelId ? field('Channel', `<#${channelId}>`) : '',
			reason ? fieldBelow('Reason', truncate(reason, VALUE_LIMIT * 2)) : '',
			changed.length
				? fieldBelow('Changes', truncate(changed.join('\n'), CHANGES_LIMIT))
				: '',
		],
		// A user target's id already shows in its field.
		footer: isUser ? undefined : (targetId ?? undefined),
	};
}

export default { auditTitle, describeAuditChanges, auditLogEntry };
