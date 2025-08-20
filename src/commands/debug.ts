import type { ApplicationCommand } from '@typings/api/commands';
import { DeviceInfo, BundleInfo, UnboundNative } from '@api/native';
import { Platform } from 'react-native';


export default {
	name: 'debug',
	description: 'Prints out information to help debug unbound.',

	execute: async () => {
		const payload = [];
		const Runtime = (HermesInternal as any).getRuntimeProperties();

		payload.push('**Debug Info:**');
		payload.push(`> **Client**: ${window.unbound.version}`);
		payload.push(`> **Loader**: ${window.UNBOUND_LOADER?.origin ?? 'N/A'} - ${window.UNBOUND_LOADER?.platform ?? 'N/A'} (Version ${window.UNBOUND_LOADER?.version ?? 'N/A'})`);
		payload.push(`> **Discord**: ${BundleInfo.Version}`);
		payload.push(`> **Build**: ${BundleInfo.Build} on ${BundleInfo.ReleaseChannel}`);
		payload.push(`> **Hermes**: ${Runtime['OSS Release Version']}`);
		payload.push(`> **Bytecode**: ${Runtime['Bytecode Version']}`);

		if (Platform.OS !== 'ios') {
			payload.push(`> **Device**: ${DeviceInfo.device} (${DeviceInfo.systemVersion})`);
		}

		let files: any[] = [];

		if (Platform.OS === 'ios') {
			try {
				const [
					deviceModel,
					iosVersion,
					appSource,
					appRegistrationType,
					isJailbroken,
					isVerified
				] = await Promise.all([
					UnboundNative.utilities.getDeviceModel(),
					UnboundNative.utilities.getIOSVersionString(),
					UnboundNative.utilities.getAppSource(),
					UnboundNative.utilities.getAppRegistrationType(),
					UnboundNative.utilities.isJailbroken(),
					UnboundNative.utilities.isVerifiedBuild()
				]);

				const verificationStatus = isVerified
					? '☑️ Verified build signature'
					: '❌ Not a verified build';

				payload.push(`> **Device Model**: ${deviceModel}`);
				payload.push(`> **iOS Version**: ${iosVersion}`);
				payload.push(`> **App Source**: ${appSource}`);
				payload.push(`> **App Registration**: ${appRegistrationType}`);
				payload.push(`> **Jailbroken**: ${isJailbroken ? 'Yes' : 'No'}`);
				payload.push(`> **Build Verification**: ${verificationStatus}`);

				try {
					const entitlementsPlist = await UnboundNative.utilities.getEntitlementsAsPlist();
					if (entitlementsPlist) {
						// TODO: someone needs to tell me how I attach a file to the command response lol
					}
				} catch (error) {
				}
			} catch (error) {
			}
		}

		const content = payload.join('\n');

		return { content };
	}
} as ApplicationCommand;