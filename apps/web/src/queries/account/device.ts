import { mutationOptions, queryOptions, skipToken } from '@tanstack/react-query';

import unwrapAuthResult from '~/queries/account/unwrap-auth-result';
import authClient from '~/lib/auth/client';

/** Approving or denying the device that shows `userCode`. */
export type DeviceDecision = {
	userCode: string;
	approve: boolean;
};

/** Every device query key starts with this. */
export const deviceKey = ['device'] as const;

/**
 * @description Looks up a device's user code; while signed in this claims it for the account, which approval requires.
 * @param userCode The code shown in the terminal, or `null` before one is submitted.
 * @returns Options for `useQuery`, idle until a code is submitted, failing with the server's message for an unknown code.
 */
export function deviceCodeQuery(userCode: string | null) {
	return queryOptions({
		queryKey: [...deviceKey, 'code', userCode],
		queryFn:
			userCode === null
				? skipToken
				: async () =>
						unwrapAuthResult(
							await authClient.device({ query: { user_code: userCode } }),
						),
		// A code is claimed once; refetching it on focus or retrying a bad one only repeats the answer.
		staleTime: Infinity,
		retry: false,
	});
}

/**
 * @description Approves or denies a device whose code this account has claimed.
 * @returns Mutation options taking the code and the decision.
 */
export function decideDeviceMutation() {
	return mutationOptions({
		mutationFn: async ({ userCode, approve }: DeviceDecision) => {
			unwrapAuthResult(
				approve
					? await authClient.device.approve({ userCode })
					: await authClient.device.deny({ userCode }),
			);
		},
	});
}

export default { deviceKey, deviceCodeQuery, decideDeviceMutation };
