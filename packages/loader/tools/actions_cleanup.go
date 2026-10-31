package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"regexp"
	"strconv"
	"time"
)

type actionsCache struct {
	ID             int64     `json:"id"`
	Ref            string    `json:"ref"`
	Key            string    `json:"key"`
	SizeInBytes    int64     `json:"size_in_bytes"`
	LastAccessedAt time.Time `json:"last_accessed_at"`
}

type actionsArtifact struct {
	ID          int64     `json:"id"`
	Name        string    `json:"name"`
	SizeInBytes int64     `json:"size_in_bytes"`
	CreatedAt   time.Time `json:"created_at"`
	Expired     bool      `json:"expired"`
	WorkflowRun struct {
		HeadBranch string `json:"head_branch"`
	} `json:"workflow_run"`
}

var pullRequestRef = regexp.MustCompile(`^refs/pull/(\d+)/`)

func pullRequestNumber(ref string) (int, bool) {
	match := pullRequestRef.FindStringSubmatch(ref)
	if match == nil {
		return 0, false
	}
	number, err := strconv.Atoi(match[1])
	return number, err == nil
}

func staleCaches(caches []actionsCache, openPullRequests map[int]bool, now time.Time, maxIdle time.Duration) []actionsCache {
	var stale []actionsCache
	for _, cache := range caches {
		number, isPullRequest := pullRequestNumber(cache.Ref)
		if (isPullRequest && !openPullRequests[number]) || now.Sub(cache.LastAccessedAt) > maxIdle {
			stale = append(stale, cache)
		}
	}
	return stale
}

func staleArtifacts(artifacts []actionsArtifact, keptBranches map[string]bool, now time.Time, maxAge time.Duration) []actionsArtifact {
	var stale []actionsArtifact
	for _, artifact := range artifacts {
		if !artifact.Expired && !keptBranches[artifact.WorkflowRun.HeadBranch] && now.Sub(artifact.CreatedAt) > maxAge {
			stale = append(stale, artifact)
		}
	}
	return stale
}

func listActionsPages[T any](path, field string) ([]T, error) {
	output, err := ghAPI(nil, "--paginate", "--slurp", path)
	if err != nil {
		return nil, err
	}
	var pages []map[string]json.RawMessage
	if err := json.Unmarshal(output, &pages); err != nil {
		return nil, err
	}
	var items []T
	for _, page := range pages {
		var pageItems []T
		if err := json.Unmarshal(page[field], &pageItems); err != nil {
			return nil, err
		}
		items = append(items, pageItems...)
	}
	return items, nil
}

func openPullRequests(repository string) (map[int]bool, map[string]bool, error) {
	output, err := ghAPI(nil, "--paginate", "--slurp", fmt.Sprintf("repos/%s/pulls?state=open&per_page=100", repository))
	if err != nil {
		return nil, nil, err
	}
	var pages [][]struct {
		Number int `json:"number"`
		Head   struct {
			Ref string `json:"ref"`
		} `json:"head"`
	}
	if err := json.Unmarshal(output, &pages); err != nil {
		return nil, nil, err
	}
	numbers, branches := map[int]bool{}, map[string]bool{}
	for _, page := range pages {
		for _, pull := range page {
			numbers[pull.Number] = true
			branches[pull.Head.Ref] = true
		}
	}
	return numbers, branches, nil
}

func gigabytes(bytes int64) string {
	return fmt.Sprintf("%.2f GB", float64(bytes)/1e9)
}

func runActionsCleanup(args []string) error {
	set := flag.NewFlagSet("actions-cleanup", flag.ContinueOnError)
	repository := set.String("repo", os.Getenv("GITHUB_REPOSITORY"), "owner/name to clean up")
	keepBranch := set.String("keep-branch", "main", "branch whose artifacts stay, since smoke comparisons read them; open pull requests' branches stay too")
	maxIdle := set.Duration("cache-idle", 7*24*time.Hour, "delete caches unused for longer than this")
	maxAge := set.Duration("artifact-age", 48*time.Hour, "delete other branches' artifacts older than this")
	maxDeletions := set.Int("max-deletions", 800, "stop after this many deletions to stay inside the API rate limit")
	dryRun := set.Bool("dry-run", false, "print what would be deleted without deleting it")
	if err := set.Parse(args); err != nil {
		return err
	}
	if *repository == "" {
		return errors.New("usage: actions-cleanup --repo <owner/name> [--dry-run]")
	}
	now := time.Now()
	open, keptBranches, err := openPullRequests(*repository)
	if err != nil {
		return err
	}
	keptBranches[*keepBranch] = true
	caches, err := listActionsPages[actionsCache](fmt.Sprintf("repos/%s/actions/caches?per_page=100", *repository), "actions_caches")
	if err != nil {
		return err
	}
	artifacts, err := listActionsPages[actionsArtifact](fmt.Sprintf("repos/%s/actions/artifacts?per_page=100", *repository), "artifacts")
	if err != nil {
		return err
	}
	verb := "Deleted"
	if *dryRun {
		verb = "Would delete"
	}
	var cacheBytes, artifactBytes int64
	cacheCount, artifactCount := 0, 0
	budget := *maxDeletions
	for _, cache := range staleCaches(caches, open, now, *maxIdle) {
		if budget == 0 {
			break
		}
		budget--
		if !*dryRun {
			if _, err := ghAPI(nil, "--method", "DELETE", fmt.Sprintf("repos/%s/actions/caches/%d", *repository, cache.ID)); err != nil {
				fmt.Printf("::warning title=Cache not deleted::%s on %s: %v\n", cache.Key, cache.Ref, err)
				continue
			}
		}
		cacheBytes += cache.SizeInBytes
		cacheCount++
	}
	for _, artifact := range staleArtifacts(artifacts, keptBranches, now, *maxAge) {
		if budget == 0 {
			break
		}
		budget--
		if !*dryRun {
			if _, err := ghAPI(nil, "--method", "DELETE", fmt.Sprintf("repos/%s/actions/artifacts/%d", *repository, artifact.ID)); err != nil {
				fmt.Printf("::warning title=Artifact not deleted::%s: %v\n", artifact.Name, err)
				continue
			}
		}
		artifactBytes += artifact.SizeInBytes
		artifactCount++
	}
	fmt.Printf("%s %d caches (%s) and %d artifacts (%s)\n", verb, cacheCount, gigabytes(cacheBytes), artifactCount, gigabytes(artifactBytes))
	return nil
}
