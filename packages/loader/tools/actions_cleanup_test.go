package main

import (
	"strings"
	"testing"
	"time"
)

func TestStaleCachesAreIdleOrFromClosedPullRequests(t *testing.T) {
	now := time.Date(2026, 10, 30, 0, 0, 0, 0, time.UTC)
	week := 7 * 24 * time.Hour
	caches := []actionsCache{
		{ID: 1, Ref: "refs/heads/main", LastAccessedAt: now.Add(-time.Hour)},
		{ID: 2, Ref: "refs/heads/main", LastAccessedAt: now.Add(-8 * 24 * time.Hour)},
		{ID: 3, Ref: "refs/pull/601/merge", LastAccessedAt: now.Add(-time.Hour)},
		{ID: 4, Ref: "refs/pull/610/merge", LastAccessedAt: now.Add(-time.Hour)},
	}
	var ids []int64
	for _, cache := range staleCaches(caches, map[int]bool{610: true}, now, week) {
		ids = append(ids, cache.ID)
	}
	if len(ids) != 2 || ids[0] != 2 || ids[1] != 3 {
		t.Fatalf("deleted caches %v, want the idle main one and the closed PR's", ids)
	}
}

func TestSupersededCachesKeepTheNewestAndAnyStillRestored(t *testing.T) {
	now := time.Date(2026, 10, 30, 0, 0, 0, 0, time.UTC)
	day := 24 * time.Hour
	sha := func(digit string) string { return strings.Repeat(digit, 40) }
	cache := func(id int64, ref, key string, created, accessed time.Duration) actionsCache {
		return actionsCache{ID: id, Ref: ref, Key: key, CreatedAt: now.Add(-created), LastAccessedAt: now.Add(-accessed)}
	}
	caches := []actionsCache{
		cache(1, "refs/heads/main", "ccache-Linux-core-tests-"+sha("1"), 5*day, 3*day),
		cache(2, "refs/heads/main", "ccache-Linux-core-tests-"+sha("2"), 2*day, time.Hour),
		cache(3, "refs/heads/main", "gradle-transforms-v2-"+strings.Repeat("a", 32), 5*day, time.Hour),
		cache(4, "refs/heads/main", "gradle-transforms-v2-"+strings.Repeat("b", 32), 2*day, 2*day),
		cache(5, "refs/heads/main", "ccache-Linux-hermes-bridge-"+sha("1"), 3*day, 2*day),
		cache(6, "refs/pull/7/merge", "ccache-Linux-core-tests-"+sha("3"), time.Hour, time.Hour),
		cache(7, "refs/heads/main", "discord-apks-alpha-354200", 5*day, 5*day),
		cache(8, "refs/heads/main", "discord-apks-alpha-354204", day, day),
		cache(9, "refs/heads/main", "bun-Linux-"+strings.Repeat("c", 64), 3*time.Hour, 2*time.Hour),
		cache(10, "refs/heads/main", "bun-Linux-"+strings.Repeat("d", 64), time.Hour, time.Hour),
	}
	var ids []int64
	for _, cache := range supersededCaches(caches, now, day) {
		ids = append(ids, cache.ID)
	}
	if len(ids) != 1 || ids[0] != 1 {
		t.Fatalf("deleted caches %v, want only main's replaced core-tests cache", ids)
	}
}

func TestStaleArtifactsKeepMainAndOpenPullRequests(t *testing.T) {
	now := time.Date(2026, 10, 30, 0, 0, 0, 0, time.UTC)
	artifact := func(id int64, branch string, age time.Duration, expired bool) actionsArtifact {
		item := actionsArtifact{ID: id, CreatedAt: now.Add(-age), Expired: expired}
		item.WorkflowRun.HeadBranch = branch
		return item
	}
	artifacts := []actionsArtifact{
		artifact(1, "main", 30*24*time.Hour, false),
		artifact(2, "ci/merged", 3*24*time.Hour, false),
		artifact(3, "ci/just-merged", time.Hour, false),
		artifact(4, "ci/gone", 30*24*time.Hour, true),
		artifact(5, "ci/open", 30*24*time.Hour, false),
	}
	stale := staleArtifacts(artifacts, map[string]bool{"main": true, "ci/open": true}, now, 48*time.Hour)
	if len(stale) != 1 || stale[0].ID != 2 {
		t.Fatalf("deleted artifacts %+v, want only the merged branch's older artifact", stale)
	}
}
