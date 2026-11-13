import { Discord } from '@unbound-app/api/metro/components';
import { metro, patcher, utils } from '@unbound-app/api';
import { cloneElement, isValidElement, useReducer, type ReactElement, type ReactNode } from 'react';
import { View } from 'react-native';

import NewTag from '~/components/new-tag';
import { openRenameSheet } from '~/components/rename-sheet';
import { isNew, lastUsed, type Session } from '~/lib/sessions';
import { rememberSessions, seenSessions, sessionNames } from '~/lib/store';

import styles from '~/patches/session-rows.style';

const SESSIONS_SCREEN = 'modules/user_settings/devices/native/UserSettingsSessions.tsx';

type RowProps = { label?: ReactNode; subLabel?: ReactNode; onPress?: () => void };

function isNewToUser(session: Session): boolean {
	const seen = seenSessions();

	return Object.keys(seen).length > 0 && isNew(seen[session.id_hash], Date.now());
}

function sessionRow(row: ReactElement<RowProps>, session: Session, rerender: () => void) {
	const name = sessionNames()[session.id_hash];
	const time = lastUsed(session);
	const label = name ? (
		<Discord.Text variant='text-md/semibold' color='text-default'>
			{name}
		</Discord.Text>
	) : (
		row.props.label
	);

	return cloneElement(row, {
		label: (
			<View style={styles.label}>
				{label}
				{isNewToUser(session) ? <NewTag /> : null}
			</View>
		),
		subLabel: (
			<View>
				{row.props.subLabel}
				{time ? (
					<Discord.Text variant='text-sm/medium' color='text-muted'>
						{time}
					</Discord.Text>
				) : null}
			</View>
		),
		onPress: () => openRenameSheet(session, rerender),
	});
}

type Component<P> = (props: P) => ReactNode;

const wrappers = new WeakMap<Component<never>, Component<never>>();

function wrapType<P>(
	type: Component<P>,
	after: (props: P, result: ReactNode) => ReactNode,
): Component<P> {
	const cached = wrappers.get(type as Component<never>) as Component<P> | undefined;

	if (cached) return cached;

	const wrapper: Component<P> = (props) => after(props, type(props));

	Object.defineProperty(wrapper, 'name', { value: type.name });
	wrappers.set(type as Component<never>, wrapper as Component<never>);

	return wrapper;
}

function SessionRowAfter(props: { session?: Session }, result: ReactNode): ReactNode {
	const [, rerender] = useReducer((count: number) => count + 1, 0);

	if (!props.session || !isValidElement<RowProps>(result)) return result;

	return sessionRow(result, props.session, rerender);
}

function sessionsAfter(_props: unknown, result: ReactNode): ReactNode {
	const rows = utils.react.filterComponents(result, 'SessionInfo');
	const sessions = rows
		.map((row) => (row.props as { session?: Session }).session)
		.filter((session): session is Session => Boolean(session));

	for (const row of rows) {
		(row as { type: unknown }).type = wrapType(
			row.type as Component<{ session?: Session }>,
			SessionRowAfter,
		);
	}

	if (sessions.length) setTimeout(() => rememberSessions(sessions), 0);

	return result;
}

/**
 * @description Marks new sessions, shows when each was last used and lets you name one by tapping it, in Settings > Devices.
 * Patches `UserSettingsSessionsContainer` and wraps its `UserSettingsSessions` and each `SessionInfo` row, so they stay patched as they re-render.
 */
export function patchSessionRows(): void {
	const Screen = metro.findByFilePath(SESSIONS_SCREEN);

	if (typeof Screen?.default !== 'function') {
		logger.warn('Better sessions skipped: Discord moved UserSettingsSessionsContainer.');

		return;
	}

	patcher.react.after(Screen, 'default', ({ result }) => {
		const list = utils.react.findComponent(result, 'UserSettingsSessions');

		if (list && typeof list.type === 'function') {
			(list as { type: unknown }).type = wrapType(
				list.type as Component<unknown>,
				sessionsAfter,
			);
		}
	});
}
