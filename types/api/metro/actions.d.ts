export namespace Actions {
	export interface Invites {
		acceptInviteAndTransitionToInviteChannel: ({ inviteKey }: ({
			inviteKey: string;
			callback?: Fn;
			context?: {
				location?: 'Invite Button Embed';
			};
		})) => Promise<void>;
	}
}

