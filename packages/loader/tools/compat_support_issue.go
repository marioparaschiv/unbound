package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

const (
	compatSupportLabel = "discord-support-policy"
	compatSupportTitle = "Raise the oldest supported Discord"
)

type compatSupportRaise struct {
	Platform   string
	Minimum    string
	Stable     string
	NewerSince time.Time
}

func dueSupportRaises(results *compatResults, reminderDays int, now time.Time) []compatSupportRaise {
	var raises []compatSupportRaise
	for _, target := range results.Targets {
		state := results.Support[target.Platform]
		if state == nil || state.NewerSince == "" {
			continue
		}
		since, err := time.Parse(time.RFC3339, state.NewerSince)
		if err != nil || now.Sub(since) <= time.Duration(reminderDays)*24*time.Hour {
			continue
		}
		raises = append(raises, compatSupportRaise{Platform: target.Platform, Minimum: state.Minimum, Stable: target.Version, NewerSince: since})
	}
	return raises
}

func compatSupportIssueTitle(raises []compatSupportRaise) string {
	parts := make([]string, len(raises))
	for index, raise := range raises {
		parts[index] = compatPlatformLabels[raise.Platform] + " " + raise.Minimum + " to " + raise.Stable
	}
	return compatSupportTitle + " (" + strings.Join(parts, ", ") + ")"
}

func compatPolicyLink(sourceURL string) string {
	if sourceURL == "" {
		return "`" + compatPolicyPath + "`"
	}
	return "[`" + compatPolicyPath + "`](" + strings.TrimSuffix(sourceURL, "/") + "/" + compatPolicyPath + ")"
}

func renderCompatSupportIssue(raises []compatSupportRaise, removable []compatLegacyName, reminderDays int, sourceURL string) string {
	var builder strings.Builder
	builder.WriteString("## " + compatSupportTitle + "\n\n")
	builder.WriteString("astral supports every Discord build from the minimum in " + compatPolicyLink(sourceURL) + " onwards. Once the stable channel has been newer than that minimum for more than " + strconv.Itoa(reminderDays) + " days, the minimum moves up to the current stable build, so code that only older builds need can go.\n\n")
	builder.WriteString("| Platform | Oldest supported | Stable | Stable newer since |\n| --- | --- | --- | --- |\n")
	android := false
	for _, raise := range raises {
		android = android || raise.Platform == "android"
		builder.WriteString("| " + compatPlatformLabels[raise.Platform] + " | " + raise.Minimum + " | " + raise.Stable + " | " + raise.NewerSince.Format("2006-01-02") + " |\n")
	}
	builder.WriteString("\nSet `minimumDiscordVersion` in the policy file to the stable versions above. Users on an older Discord then see a warning that astral no longer supports their version.\n\n")
	builder.WriteString("### What raising it lets the team remove\n\n")
	if !android || len(removable) == 0 {
		builder.WriteString("No legacy name is waiting on the minimum, so raising it removes nothing yet. It still lets the next names Discord drops go sooner.\n")
		return builder.String()
	}
	builder.WriteString("The stable build no longer has these legacy names. Once it is the oldest supported build, the `" + compatLegacyLabel + "` issue lists them, and the code that handles them can go:\n\n")
	for _, name := range removable {
		links := make([]string, len(name.Locations))
		for index, location := range name.Locations {
			links[index] = compatLocationLink(location, sourceURL)
		}
		builder.WriteString("- class `" + name.Name + "` · " + strings.Join(links, ", ") + "\n")
	}
	return builder.String()
}

func planSingleIssue(open []compatIssue, prefix, title string, active bool, doneComment string) compatIssuePlan {
	plan := compatIssuePlan{Title: title}
	var relevant []compatIssue
	for _, issue := range open {
		if strings.HasPrefix(issue.Title, prefix) {
			relevant = append(relevant, issue)
		}
	}
	sortIssuesNewestFirst(relevant)
	if !active {
		for _, issue := range relevant {
			plan.Close = append(plan.Close, compatIssueClose{Number: issue.Number, Comment: doneComment})
		}
		return plan
	}
	if len(relevant) == 0 {
		plan.Create = true
		return plan
	}
	plan.Update = relevant[0].Number
	for _, issue := range relevant[1:] {
		plan.Close = append(plan.Close, compatIssueClose{Number: issue.Number})
	}
	return plan
}

func planCompatSupportIssue(open []compatIssue, raises []compatSupportRaise) compatIssuePlan {
	title := compatSupportTitle
	if len(raises) > 0 {
		title = compatSupportIssueTitle(raises)
	}
	return planSingleIssue(open, compatSupportTitle, title, len(raises) > 0, supportCurrentComment())
}

func supportCurrentComment() string {
	return "The oldest supported Discord versions are current, so there is nothing to raise."
}

func runCompatSupportIssue(args []string) error {
	set := flag.NewFlagSet("compat-support-issue", flag.ContinueOnError)
	resultsPath := set.String("results", "", "results JSON from the stable channel's compat-scan")
	root := set.String("root", "../..", "monorepo root")
	repository := set.String("repo", os.Getenv("GITHUB_REPOSITORY"), "owner/name of the repository")
	sourceURL := set.String("source-url", "", "base URL linking locations to the source")
	if err := set.Parse(args); err != nil {
		return err
	}
	if *resultsPath == "" || *repository == "" {
		return errors.New("usage: compat-support-issue --results <json> [--root <monorepo>] [--repo <owner/name>] [--source-url <url>]")
	}
	data, err := os.ReadFile(*resultsPath)
	if err != nil {
		return err
	}
	var results compatResults
	if err := json.Unmarshal(data, &results); err != nil {
		return fmt.Errorf("results: %w", err)
	}
	policy, err := loadCompatPolicy(*root)
	if err != nil {
		return err
	}
	raises := dueSupportRaises(&results, policy.ReminderDays, time.Now().UTC())
	body, err := os.CreateTemp("", "compat-support-*.md")
	if err != nil {
		return err
	}
	defer os.Remove(body.Name())
	if _, err := body.WriteString(renderCompatSupportIssue(raises, removableLegacyNames(&results), policy.ReminderDays, *sourceURL)); err != nil {
		body.Close()
		return err
	}
	if err := body.Close(); err != nil {
		return err
	}
	github := ghCLI{}
	open, err := github.openIssues(*repository, compatSupportLabel)
	if err != nil {
		return err
	}
	number, err := applyCompatIssuePlan(github, *repository, compatSupportLabel, body.Name(), planCompatSupportIssue(open, raises))
	if number != 0 {
		fmt.Printf("Support policy issue #%d proposes raising the minimum for %d platforms\n", number, len(raises))
	}
	return err
}
