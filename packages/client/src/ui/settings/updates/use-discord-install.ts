import type { NativeAndroidInstallProgress } from '@unbound-app/types/native-platform';
import type { AndroidBuild } from '@unbound-app/contracts/android-builds';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { discordInstaller, isOlderDiscord } from '~/updates/discord-builds';
import UpdatesStore from '~/updates/state';
import { confirm } from '~/dialogs/api';

const POLL_MS = 500;
const ACTIVE_PHASES = new Set(['downloading', 'installing', 'confirming']);

const IDLE: NativeAndroidInstallProgress = { phase: 'idle', downloaded: 0, total: 0, error: null };

/**
 * @description Drives the in-app Discord installer: polls its progress while it works, re-checks after the
 * user returns from the permission screen, and confirms before installing an older Discord.
 * @returns The installer's progress, and actions to install a build, cancel, and request the install permission.
 */
function useDiscordInstall() {
	const installer = discordInstaller();
	const [progress, setProgress] = useState(() => installer?.progress() ?? IDLE);
	const active = ACTIVE_PHASES.has(progress.phase);

	useEffect(() => {
		if (!installer || !active) return;

		const timer = setInterval(() => setProgress(installer.progress()), POLL_MS);

		return () => clearInterval(timer);
	}, [installer, active]);

	useEffect(() => {
		function handler(state: string) {
			if (state !== 'active' || !installer) return;

			setProgress(installer.progress());

			const store = UpdatesStore.getState();

			// The permission screen is another app, so returning from it is the only signal that it changed.
			if (
				store.state.status === 'ready' &&
				store.state.discord?.status.availability === 'needs-permission'
			) {
				void store.check();
			}
		}

		const subscription = AppState.addEventListener('change', handler);

		return () => subscription.remove();
	}, [installer]);

	async function install(build: AndroidBuild, versionName: string) {
		if (!installer) return;

		if (
			isOlderDiscord(build, versionName) &&
			!(await confirm('UNBOUND_DISCORD_DOWNGRADE_TITLE', {
				body: 'UNBOUND_DISCORD_DOWNGRADE_DESC',
				bodyVars: { version: build.discordVersion },
				confirm: 'UNBOUND_INSTALL',
				destructive: true,
			}))
		) {
			return;
		}

		installer.install(build.splits);
		setProgress(installer.progress());
	}

	function cancel() {
		installer?.cancel();
		setProgress(installer?.progress() ?? IDLE);
	}

	function requestPermission() {
		installer?.requestPermission();
	}

	return { progress, active, install, cancel, requestPermission };
}

export default useDiscordInstall;
