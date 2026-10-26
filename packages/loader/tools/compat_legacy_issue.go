package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"sort"
	"strings"
)

const (
	compatLegacyLabel = "discord-compat-cleanup"
	compatLegacyTitle = "Legacy Discord names to remove"
)

type compatLegacyName struct {
	Name      string
	Locations []compatLocation
}

func removableLegacyNames(results *compatResults) []compatLegacyName {
	marked := map[string]bool{}
	missing := map[string]bool{}
	for _, finding := range results.Findings {
		reference := finding.Reference
		if finding.Platform != "android" || !reference.Legacy {
			continue
		}
		marked[reference.Component+"#"+reference.Name] = true
		if finding.Status == compatFallback {
			missing[reference.Name] = true
		}
	}
	locations := map[string]map[compatLocation]bool{}
	for _, finding := range results.Findings {
		reference := finding.Reference
		if finding.Platform != "android" || !missing[reference.Name] || !marked[reference.Component+"#"+reference.Name] {
			continue
		}
		if locations[reference.Name] == nil {
			locations[reference.Name] = map[compatLocation]bool{}
		}
		for _, location := range reference.Locations {
			locations[reference.Name][location] = true
		}
	}
	names := make([]compatLegacyName, 0, len(locations))
	for name, set := range locations {
		entry := compatLegacyName{Name: name}
		for location := range set {
			entry.Locations = append(entry.Locations, location)
		}
		sort.Slice(entry.Locations, func(left, right int) bool {
			a, b := entry.Locations[left], entry.Locations[right]
			return a.File < b.File || a.File == b.File && a.Line < b.Line
		})
		names = append(names, entry)
	}
	sort.Slice(names, func(left, right int) bool { return names[left].Name < names[right].Name })
	return names
}

func androidVersion(results *compatResults) string {
	for _, target := range results.Targets {
		if target.Platform == "android" {
			return target.Version
		}
	}
	return ""
}

func renderCompatLegacyIssue(names []compatLegacyName, version, sourceURL string) string {
	var builder strings.Builder
	builder.WriteString("## " + compatLegacyTitle + "\n\n")
	builder.WriteString("Discord Android " + version + " on the stable channel no longer has these names. Beta and alpha builds are newer, so no channel has them, and the code that handles them can go along with their `HostClass.legacy` or `legacyJavaClass` marks.\n\n")
	for _, name := range names {
		links := make([]string, len(name.Locations))
		for index, location := range name.Locations {
			links[index] = compatLocationLink(location, sourceURL)
		}
		builder.WriteString("- class `" + name.Name + "` · " + strings.Join(links, ", ") + "\n")
	}
	return builder.String()
}

func planCompatLegacyIssue(open []compatIssue, version string, removable bool) compatIssuePlan {
	plan := compatIssuePlan{Title: compatLegacyTitle + " (Android " + version + ")"}
	var relevant []compatIssue
	for _, issue := range open {
		if strings.HasPrefix(issue.Title, compatLegacyTitle) {
			relevant = append(relevant, issue)
		}
	}
	sort.Slice(relevant, func(left, right int) bool { return relevant[left].Number > relevant[right].Number })
	if !removable {
		for _, issue := range relevant {
			plan.Close = append(plan.Close, compatIssueClose{Number: issue.Number, Comment: legacyKeptComment(version)})
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

func legacyKeptComment(version string) string {
	return "Discord Android " + version + " on the stable channel still has every name marked legacy, so there is nothing left to remove."
}

func runCompatLegacyIssue(args []string) error {
	set := flag.NewFlagSet("compat-legacy-issue", flag.ContinueOnError)
	resultsPath := set.String("results", "", "results JSON from the stable channel's compat-scan")
	repository := set.String("repo", os.Getenv("GITHUB_REPOSITORY"), "owner/name of the repository")
	sourceURL := set.String("source-url", "", "base URL linking locations to the source")
	if err := set.Parse(args); err != nil {
		return err
	}
	if *resultsPath == "" || *repository == "" {
		return errors.New("usage: compat-legacy-issue --results <json> [--repo <owner/name>] [--source-url <url>]")
	}
	data, err := os.ReadFile(*resultsPath)
	if err != nil {
		return err
	}
	var results compatResults
	if err := json.Unmarshal(data, &results); err != nil {
		return fmt.Errorf("results: %w", err)
	}
	version := androidVersion(&results)
	if version == "" {
		return errors.New("the results have no Android scan")
	}
	names := removableLegacyNames(&results)
	body, err := os.CreateTemp("", "compat-legacy-*.md")
	if err != nil {
		return err
	}
	defer os.Remove(body.Name())
	if _, err := body.WriteString(renderCompatLegacyIssue(names, version, *sourceURL)); err != nil {
		body.Close()
		return err
	}
	if err := body.Close(); err != nil {
		return err
	}
	github := ghCLI{}
	open, err := github.openIssues(*repository, compatLegacyLabel)
	if err != nil {
		return err
	}
	plan := planCompatLegacyIssue(open, version, len(names) > 0)
	number, err := applyCompatIssuePlan(github, *repository, compatLegacyLabel, body.Name(), plan)
	if number != 0 {
		fmt.Printf("Legacy cleanup issue #%d lists %d names\n", number, len(names))
	}
	return err
}
