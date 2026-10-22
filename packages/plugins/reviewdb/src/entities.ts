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

export enum NotificationType {
	Info = 0,
	Ban = 1,
	Unban = 2,
	Warning = 3,
}

export interface Badge {
	name: string;
	description: string;
	icon: string;
	redirectURL?: string;
	type: number;
}

export interface BanInfo {
	id: string;
	discordID: string;
	reviewID: number;
	reviewContent: string;
	banEndDate: number;
}

export interface Notification {
	id: number;
	title: string;
	content: string;
	type: NotificationType;
}

export interface ReviewDBUser {
	ID: number;
	discordID: string;
	username: string;
	type: UserType;
	profilePhoto: string;
	badges: Badge[];
}

export interface ReviewDBCurrentUser extends ReviewDBUser {
	warningCount: number;
	clientMod: string;
	banInfo: BanInfo | null;
	notification: Notification | null;
	lastReviewID: number;
	blockedUsers?: string[];
}

export interface ReviewAuthor {
	id: number;
	discordID: string;
	username: string;
	profilePhoto: string;
	badges: Badge[];
}

export interface Review {
	comment: string;
	id: number;
	score?: number;
	star: number;
	sender: ReviewAuthor;
	timestamp: number;
	type?: ReviewType;
	userVote?: boolean | null;
}
