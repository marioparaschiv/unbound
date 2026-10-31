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

func renderCompatLegacyIssue(names []compatLegacyName, version, minimum, sourceURL string) string {
	var builder strings.Builder
	builder.WriteString("## " + compatLegacyTitle + "\n\n")
	builder.WriteString("astral supports Discord Android " + minimum + " and newer, as `" + compatPolicyPath + "` sets. A legacy name can go once the oldest supported build no longer has it, because no newer build has it either.\n\n")
	builder.WriteString("The stable scan checked Android " + version + ", and no supported build is older than it, so these names are gone from every supported build. The code that handles them can go along with their `HostClass.legacy` or `legacyJavaClass` marks.\n\n")
	builder.WriteString("Once stable moves past the oldest supported build, the scan cannot tell what that build still has, so the list stays as it is until the minimum is raised. The `" + compatSupportLabel + "` issue proposes raising it.\n\n")
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
	return planSingleIssue(open, compatLegacyTitle, compatLegacyTitle+" (Android "+version+")", removable, legacyKeptComment(version))
}

func legacyKeptComment(version string) string {
	return "Discord Android " + version + ", the oldest supported build, still has every name marked legacy, so there is nothing left to remove."
}

func legacyScanCoversMinimum(version, minimum string) (bool, error) {
	order, err := compareDiscordVersions(version, minimum)
	return order <= 0, err
}

func runCompatLegacyIssue(args []string) error {
	set := flag.NewFlagSet("compat-legacy-issue", flag.ContinueOnError)
	resultsPath := set.String("results", "", "results JSON from the stable channel's compat-scan")
	root := set.String("root", "../..", "monorepo root")
	repository := set.String("repo", os.Getenv("GITHUB_REPOSITORY"), "owner/name of the repository")
	sourceURL := set.String("source-url", "", "base URL linking locations to the source")
	if err := set.Parse(args); err != nil {
		return err
	}
	if *resultsPath == "" || *repository == "" {
		return errors.New("usage: compat-legacy-issue --results <json> [--root <monorepo>] [--repo <owner/name>] [--source-url <url>]")
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
	policy, err := loadCompatPolicy(*root)
	if err != nil {
		return err
	}
	minimum := policy.Minimum["android"]
	covers, err := legacyScanCoversMinimum(version, minimum)
	if err != nil {
		return err
	}
	if !covers {
		fmt.Printf("Discord Android %s is newer than the oldest supported %s, so nothing more is removable until the minimum is raised\n", version, minimum)
		return nil
	}
	names := removableLegacyNames(&results)
	body, err := os.CreateTemp("", "compat-legacy-*.md")
	if err != nil {
		return err
	}
	defer os.Remove(body.Name())
	if _, err := body.WriteString(renderCompatLegacyIssue(names, version, minimum, *sourceURL)); err != nil {
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
