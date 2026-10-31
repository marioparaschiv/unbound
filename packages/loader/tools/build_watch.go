package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"time"
)

type pathFilter struct {
	pattern *regexp.Regexp
	exclude bool
}

type mainCommit struct {
	SHA       string
	Committed time.Time
	Files     []string
}

var workflowPathEntry = regexp.MustCompile(`^\s+- ['"]?([^'"]+)['"]?\s*$`)

func pushPathFilters(workflow string) ([]pathFilter, error) {
	var filters []pathFilter
	inPush, inPaths := false, false
	for _, line := range strings.Split(workflow, "\n") {
		trimmed := strings.TrimSpace(line)
		switch {
		case line == "    push:":
			inPush = true
		case inPush && trimmed == "paths:":
			inPaths = true
		case inPaths:
			match := workflowPathEntry.FindStringSubmatch(line)
			if match == nil {
				return filters, nil
			}
			glob, exclude := strings.CutPrefix(match[1], "!")
			filters = append(filters, pathFilter{pattern: globPattern(glob), exclude: exclude})
		case inPush && !strings.HasPrefix(line, "        ") && trimmed != "":
			inPush = false
		}
	}
	if len(filters) == 0 {
		return nil, errors.New("the workflow has no push paths")
	}
	return filters, nil
}

func globPattern(glob string) *regexp.Regexp {
	var pattern strings.Builder
	pattern.WriteString("^")
	for index := 0; index < len(glob); index++ {
		switch {
		case strings.HasPrefix(glob[index:], "**/"):
			pattern.WriteString("(?:.*/)?")
			index += 2
		case strings.HasPrefix(glob[index:], "**"):
			pattern.WriteString(".*")
			index++
		case glob[index] == '*':
			pattern.WriteString("[^/]*")
		default:
			pattern.WriteString(regexp.QuoteMeta(glob[index : index+1]))
		}
	}
	pattern.WriteString("$")
	return regexp.MustCompile(pattern.String())
}

func triggersBuild(filters []pathFilter, files []string) bool {
	for _, file := range files {
		included := false
		for _, filter := range filters {
			if filter.pattern.MatchString(file) {
				included = !filter.exclude
			}
		}
		if included {
			return true
		}
	}
	return false
}

func commitsWithoutBuilds(commits []mainCommit, filters []pathFilter, built map[string]bool, now time.Time, grace time.Duration) []mainCommit {
	var missing []mainCommit
	for _, commit := range commits {
		if now.Sub(commit.Committed) >= grace && triggersBuild(filters, commit.Files) && !built[commit.SHA] {
			missing = append(missing, commit)
		}
	}
	return missing
}

func parseMainCommits(log string) []mainCommit {
	var commits []mainCommit
	for _, block := range strings.Split(log, "\x1e") {
		lines := strings.Split(strings.TrimSpace(block), "\n")
		if len(lines) == 0 || lines[0] == "" {
			continue
		}
		sha, timestamp, found := strings.Cut(lines[0], " ")
		seconds, err := strconv.ParseInt(timestamp, 10, 64)
		if !found || err != nil {
			continue
		}
		commit := mainCommit{SHA: sha, Committed: time.Unix(seconds, 0)}
		for _, file := range lines[1:] {
			if file = strings.TrimSpace(file); file != "" {
				commit.Files = append(commit.Files, file)
			}
		}
		commits = append(commits, commit)
	}
	return commits
}

func builtCommits(repository, workflow string, since time.Time) (map[string]bool, error) {
	output, err := ghAPI(nil, "--paginate", "--slurp", fmt.Sprintf("repos/%s/actions/workflows/%s/runs?branch=main&per_page=100&created=>=%s", repository, workflow, since.UTC().Format(time.RFC3339)))
	if err != nil {
		return nil, err
	}
	var pages []struct {
		WorkflowRuns []struct {
			HeadSHA string `json:"head_sha"`
		} `json:"workflow_runs"`
	}
	if err := json.Unmarshal(output, &pages); err != nil {
		return nil, err
	}
	built := map[string]bool{}
	for _, page := range pages {
		for _, run := range page.WorkflowRuns {
			built[run.HeadSHA] = true
		}
	}
	return built, nil
}

func runBuildWatch(args []string) error {
	set := flag.NewFlagSet("build-watch", flag.ContinueOnError)
	repository := set.String("repo", os.Getenv("GITHUB_REPOSITORY"), "owner/name whose main builds to check")
	workflowFile := set.String("workflow", "../../.github/workflows/loader-build.yml", "workflow whose push paths decide which commits need a build")
	window := set.Duration("window", 24*time.Hour, "how far back to look at main commits")
	grace := set.Duration("grace", 30*time.Minute, "how long a commit may wait for its build to start")
	if err := set.Parse(args); err != nil {
		return err
	}
	if *repository == "" {
		return errors.New("usage: build-watch --repo <owner/name>")
	}
	workflow, err := os.ReadFile(*workflowFile)
	if err != nil {
		return err
	}
	filters, err := pushPathFilters(string(workflow))
	if err != nil {
		return err
	}
	now := time.Now()
	since := now.Add(-*window)
	log, err := exec.Command("git", "log", "origin/main", "--since="+since.Format(time.RFC3339), "--format=%x1e%H %ct", "--name-only").Output()
	if err != nil {
		return fmt.Errorf("read main's commits: %w", err)
	}
	built, err := builtCommits(*repository, "loader-build.yml", since.Add(-time.Hour))
	if err != nil {
		return err
	}
	missing := commitsWithoutBuilds(parseMainCommits(string(log)), filters, built, now, *grace)
	for _, commit := range missing {
		fmt.Printf("::error title=Missing loader build::%s changed the loader %s ago but loader-build never ran for it\n", commit.SHA[:12], now.Sub(commit.Committed).Round(time.Minute))
	}
	if len(missing) > 0 {
		return fmt.Errorf("%d main commits that change the loader have no loader-build run", len(missing))
	}
	fmt.Println("every main commit that changes the loader has a loader-build run")
	return nil
}
