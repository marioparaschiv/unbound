export enum UserType {
	Banned = -1,
	Normal = 0,
	Admin = 1,
}

export enum ReviewType {
	User = 0,
	Server = 1,
	Support = 2,
	System = 3,
}

export type ReviewDBUser = {
	discordID: string;
	username: string;
	profilePhoto: string;
	type: UserType;
};

export type ReviewDBCurrentUser = ReviewDBUser & {
	lastReviewID: number;
	blockedUsers?: string[];
};

export type Review = {
	id: number;
	comment: string | null;
	score?: number;
	sender: Omit<ReviewDBUser, 'type'>;
	timestamp: number;
	type?: ReviewType;
	/** `true` for the viewer's upvote, `false` for a downvote, `null` for no vote. */
	userVote?: boolean | null;
};

export type ReviewVote = {
	reviewID: number;
	isUpvote: boolean;
};

export type UserReviewsData = {
	message: string;
	reviews: Review[];
	hasNextPage: boolean;
	reviewCount: number;
};
