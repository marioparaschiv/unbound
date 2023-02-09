import { findByProps } from '@metro';

export const AsyncUsers = findByProps('fetchProfile', { lazy: true });