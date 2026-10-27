package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"sort"
	"strconv"
	"strings"
)

const compatIssueLabel = "discord-compat"

type compatIssue struct {
	Number int    `json:"number"`
	Title  string `json:"title"`
}

type compatIssueClose struct {
	Number  int
	Comment string
}

type compatIssuePlan struct {
	Title  string
	Update int
	Create bool
	Close  []compatIssueClose
}

func compatIssuePrefix(channel string) string {
	return "Discord compatibility (" + channel + ")"
}

func compatIssueVersions(results *compatResults) string {
	var parts []string
	for _, target := range results.Targets {
		parts = append(parts, compatPlatformLabels[target.Platform]+" "+target.Version)
	}
	return strings.Join(parts, ", ")
}

func planCompatIssue(open []compatIssue, channel, versions string, problems bool) compatIssuePlan {
	prefix := compatIssuePrefix(channel)
	plan := compatIssuePlan{Title: prefix + ": " + versions}
	var relevant []compatIssue
	for _, issue := range open {
		if strings.HasPrefix(issue.Title, prefix) {
			relevant = append(relevant, issue)
		}
	}
	sortIssuesNewestFirst(relevant)
	if !problems {
		for _, issue := range relevant {
			plan.Close = append(plan.Close, compatIssueClose{Number: issue.Number, Comment: resolvedComment(versions)})
		}
		return plan
	}
	for _, issue := range relevant {
		if issue.Title == plan.Title {
			plan.Update = issue.Number
			break
		}
	}
	plan.Create = plan.Update == 0
	for _, issue := range relevant {
		if issue.Number != plan.Update {
			plan.Close = append(plan.Close, compatIssueClose{Number: issue.Number})
		}
	}
	return plan
}

func sortIssuesNewestFirst(issues []compatIssue) {
	sort.Slice(issues, func(left, right int) bool { return issues[left].Number > issues[right].Number })
}

func resolvedComment(versions string) string {
	return "The latest scan against Discord " + versions + " reports no breakages, so this issue is resolved."
}

func supersededComment(number int) string {
	return "Superseded by #" + strconv.Itoa(number)
}

type compatGitHub interface {
	openIssues(repository, label string) ([]compatIssue, error)
	updateIssue(repository string, number int, title, bodyFile string) error
	createIssue(repository, title, label, bodyFile string) (int, error)
	closeIssue(repository string, number int, comment string) error
}

type ghCLI struct{}

func (ghCLI) run(args ...string) ([]byte, error) {
	command := exec.Command("gh", args...)
	command.Stderr = os.Stderr
	return command.Output()
}

func (cli ghCLI) openIssues(repository, label string) ([]compatIssue, error) {
	output, err := cli.run("issue", "list", "--repo", repository, "--label", label, "--state", "open", "--limit", "100", "--json", "number,title")
	if err != nil {
		return nil, err
	}
	var issues []compatIssue
	return issues, json.Unmarshal(output, &issues)
}

func (cli ghCLI) updateIssue(repository string, number int, title, bodyFile string) error {
	_, err := cli.run("issue", "edit", strconv.Itoa(number), "--repo", repository, "--title", title, "--body-file", bodyFile)
	return err
}

func (cli ghCLI) createIssue(repository, title, label, bodyFile string) (int, error) {
	output, err := cli.run("issue", "create", "--repo", repository, "--title", title, "--label", label, "--body-file", bodyFile)
	if err != nil {
		return 0, err
	}
	url := strings.TrimSpace(string(output))
	number, err := strconv.Atoi(url[strings.LastIndex(url, "/")+1:])
	if err != nil {
		return 0, fmt.Errorf("unexpected gh issue create output %q", url)
	}
	return number, nil
}

func (cli ghCLI) closeIssue(repository string, number int, comment string) error {
	_, err := cli.run("issue", "close", strconv.Itoa(number), "--repo", repository, "--comment", comment)
	return err
}

func applyCompatIssuePlan(github compatGitHub, repository, label, bodyFile string, plan compatIssuePlan) (int, error) {
	current := plan.Update
	switch {
	case plan.Update != 0:
		if err := github.updateIssue(repository, plan.Update, plan.Title, bodyFile); err != nil {
			return 0, err
		}
	case plan.Create:
		number, err := github.createIssue(repository, plan.Title, label, bodyFile)
		if err != nil {
			return 0, err
		}
		current = number
	}
	for _, closing := range plan.Close {
		comment := closing.Comment
		if comment == "" {
			comment = supersededComment(current)
		}
		if err := github.closeIssue(repository, closing.Number, comment); err != nil {
			return current, err
		}
	}
	return current, nil
}

func runCompatIssue(args []string) error {
	set := flag.NewFlagSet("compat-issue", flag.ContinueOnError)
	resultsPath := set.String("results", "", "results JSON from compat-scan")
	reportPath := set.String("report", "", "markdown report from compat-scan")
	channel := set.String("channel", "", "release channel label")
	repository := set.String("repo", os.Getenv("GITHUB_REPOSITORY"), "owner/name of the repository")
	if err := set.Parse(args); err != nil {
		return err
	}
	if *resultsPath == "" || *reportPath == "" || *channel == "" || *repository == "" {
		return errors.New("usage: compat-issue --results <json> --report <md> --channel <name> [--repo <owner/name>]")
	}
	data, err := os.ReadFile(*resultsPath)
	if err != nil {
		return err
	}
	var results compatResults
	if err := json.Unmarshal(data, &results); err != nil {
		return fmt.Errorf("results: %w", err)
	}
	github := ghCLI{}
	open, err := github.openIssues(*repository, compatIssueLabel)
	if err != nil {
		return err
	}
	plan := planCompatIssue(open, *channel, compatIssueVersions(&results), compatHasProblems(&results))
	number, err := applyCompatIssuePlan(github, *repository, compatIssueLabel, *reportPath, plan)
	if number != 0 {
		fmt.Printf("Discord compatibility issue #%d is current\n", number)
	}
	return err
}
