/** A running privacy screen: stops it, or checks it works. */
export type PrivacyScreen = {
	stop(): void;
	test(): Promise<{ ok: boolean; detail: string }>;
};
