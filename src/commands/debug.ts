import type { ApplicationCommand } from '@typings/api/commands';
import { DeviceInfo, BundleInfo, UnboundNative } from '@api/native';
import { Platform } from 'react-native';

export default {
	name: 'debug',
	description: 'Prints out information to help debug unbound.',

	execute: async () => {
		const payload = [];
		const Runtime = (HermesInternal as any).getRuntimeProperties();

		payload.push('**Debug Info**:');
		payload.push('');
		payload.push(`- **Client:** ${window.unbound.version}`);
		payload.push(`- **Discord:** ${BundleInfo.Version}`);
		payload.push(`- **Build:** ${BundleInfo.Build} on ${BundleInfo.ReleaseChannel}`);
		payload.push(`- **Loader:** ${window.UNBOUND_LOADER?.origin ?? 'N/A'} (${window.UNBOUND_LOADER?.version ?? 'N/A'})`);
		payload.push(`- **Hermes:** ${Runtime['OSS Release Version']}`);
		payload.push(`- **Bytecode:** ${Runtime['Bytecode Version']}`);

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
					UnboundNative.utilities.getiOSVersionString(),
					UnboundNative.utilities.getAppSource(),
					UnboundNative.utilities.getAppRegistrationType(),
					UnboundNative.utilities.isJailbroken(),
					UnboundNative.utilities.isVerifiedBuild()
				]);

				payload.push(`- **Device:** ${deviceModel}`);
				payload.push(`- **iOS:** ${iosVersion}`);
				payload.push(`- **State:** ${isJailbroken ? 'Jailbroken' : 'Jailed'}`);
				payload.push(`- **Source:** ${appSource}`);
				payload.push(`- **Registration:** ${appRegistrationType}`);
				payload.push(`- **Verification:** ${isVerified ? 'Valid Signature' : 'Invalid Signature'}`);

				try {
					const entitlementsPlist = await UnboundNative.utilities.getEntitlementsAsPlist();
					if (entitlementsPlist) {
						// TODO: someone needs to tell me how to attach files to the command response lol
						// I'm guessing Messages#sendMessage() is involved
					}
				} catch (error) {
				}
			} catch (error) {
			}
		} else {
			payload.push(`- **Device:** ${DeviceInfo.device}`);
			payload.push(`- **OS:** ${DeviceInfo.systemVersion}`);
		}

		const content = payload.join('\n');

		return { content };
	}
} as ApplicationCommand;
