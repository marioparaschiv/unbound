package main

import (
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
