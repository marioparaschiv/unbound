package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// loaderChangelogLimit caps the commits one changelog lists, keeping it under the API's changelog length.
const loaderChangelogLimit = 50

var loaderConventionalCommitPattern = regexp.MustCompile("(?i)^([a-z]+)(?:\\(([^)]*)\\))?(!)?:\\s*(.+)$")

type loaderChangelogEntry struct {
	category string
	scope    string
	summary  string
	breaking bool
}

func runGenerateLoaderChangelog(args []string) error {
	set := flag.NewFlagSet("generate-loader-changelog", flag.ContinueOnError)
	root := set.String("root", ".", "loader repository root")
	version := set.String("version", "", "loader semantic version")
	output := set.String("output", "", "output changelog path")
	apiURL := set.String("api-url", "", "loader release endpoint (/api/v1/loader/releases); lists the changes since its latest iOS release instead of the last loader commit alone")
	if err := set.Parse(args); err != nil {
		return err
	}
	if *version == "" {
		return errors.New("loader semantic version is required")
	}
	if *output == "" {
		return errors.New("loader changelog output path is required")
	}

	previous := ""
	if *apiURL != "" {
		latest, _, err := latestLoaderReleaseVersion(context.Background(), *apiURL, "ios", lookupClient(30*time.Second))
		if err != nil {
			return err
		}
		previous = latest
	}
	changelog, err := generateLoaderChangelog(*root, *version, previous)
	if err != nil {
		return err
	}
	outputPath := *output
	if !filepath.IsAbs(outputPath) {
		outputPath = filepath.Join(*root, outputPath)
	}
	if err := os.WriteFile(outputPath, []byte(changelog+"\n"), 0o600); err != nil {
		return fmt.Errorf("write loader changelog: %w", err)
	}
	return nil
}

// generateLoaderChangelog lists the loader commits since previous, whose patch is its loader commit count. Without a
// usable previous version (none, 1.0.0 or not older) it lists the commit that made this version alone.
func generateLoaderChangelog(root string, version string, previous string) (string, error) {
	if _, err := parseSemanticVersion(version); err != nil {
		return "", fmt.Errorf("invalid loader changelog version: %w", err)
	}
	currentVersion, err := loaderVersion(root)
	if err != nil {
		return "", fmt.Errorf("read loader version: %w", err)
	}
	if currentVersion != version {
		return "", fmt.Errorf("requested loader changelog version %s does not match the checkout's loader version %s", version, currentVersion)
	}
	parsed, _ := parseSemanticVersion(version)
	count, _ := strconv.Atoi(parsed.patch)

	since := count - 1
	if previousVersion, err := parseSemanticVersion(previous); err == nil {
		if patch, _ := strconv.Atoi(previousVersion.patch); patch >= 1 && patch < count {
			since = patch
		}
	}
	limit := min(count-since, loaderChangelogLimit)
	arguments := append([]string{"log", "--format=%s", "-n", strconv.Itoa(limit), "HEAD", "--"}, loaderVersionPathspec...)
	subjects, err := gitOutput(root, defaultRunner, arguments...)
	if err != nil {
		return "", fmt.Errorf("read loader changes since %d: %w", since, err)
	}

	return renderLoaderChangelog(version, strings.Split(strings.TrimSpace(subjects), "\n")), nil
}

func renderLoaderChangelog(version string, subjects []string) string {
	entries := make([]loaderChangelogEntry, 0, len(subjects))
	categories := map[string]bool{}
	for _, subject := range subjects {
		match := loaderConventionalCommitPattern.FindStringSubmatch(strings.TrimSpace(subject))
		if match == nil {
			continue
		}
		category := loaderChangeCategory(strings.ToLower(match[1]))
		entry := loaderChangelogEntry{
			category: category,
			scope:    match[2],
			summary:  capitalizeLoaderSummary(match[4]),
			breaking: match[3] == "!",
		}
		entries = append(entries, entry)
		if entry.breaking {
			categories["Breaking Changes"] = true
		} else {
			categories[category] = true
		}
	}

	categoryOrder := []string{
		"Breaking Changes",
		"Features",
		"Fixes",
		"Performance",
		"Refactoring",
		"Documentation",
		"Build and CI",
		"Maintenance",
		"Reverts",
		"Other Changes",
	}
	result := []string{"# Loader " + version}
	for _, category := range categoryOrder {
		if !categories[category] {
			continue
		}
		result = append(result, "", "## "+category)
		for _, entry := range entries {
			if entry.breaking && category == "Breaking Changes" || !entry.breaking && entry.category == category {
				result = append(result, "- "+formatLoaderChangelogEntry(entry))
			}
		}
	}
	if len(entries) == 0 {
		result = append(result, "", "No conventional loader changes were recorded for this version.")
	}
	return strings.Join(result, "\n")
}

func loaderChangeCategory(commitType string) string {
	switch commitType {
	case "feat":
		return "Features"
	case "fix":
		return "Fixes"
	case "perf":
		return "Performance"
	case "refactor":
		return "Refactoring"
	case "docs":
		return "Documentation"
	case "build", "ci":
		return "Build and CI"
	case "revert":
		return "Reverts"
	case "chore", "style", "test":
		return "Maintenance"
	default:
		return "Other Changes"
	}
}

func formatLoaderChangelogEntry(entry loaderChangelogEntry) string {
	if entry.scope != "" {
		return "**" + entry.scope + ":** " + entry.summary
	}
	return entry.summary
}

func capitalizeLoaderSummary(summary string) string {
	runes := []rune(strings.TrimSpace(summary))
	if len(runes) == 0 {
		return ""
	}
	return strings.ToUpper(string(runes[0])) + string(runes[1:])
}
