package main

import (
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

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
	if err := set.Parse(args); err != nil {
		return err
	}
	if *version == "" {
		return errors.New("loader semantic version is required")
	}
	if *output == "" {
		return errors.New("loader changelog output path is required")
	}

	changelog, err := generateLoaderChangelog(*root, *version)
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

func generateLoaderChangelog(root string, version string) (string, error) {
	if _, err := parseSemanticVersion(version); err != nil {
		return "", fmt.Errorf("invalid loader changelog version: %w", err)
	}
	currentVersion, err := packageVersion(root)
	if err != nil {
		return "", fmt.Errorf("read loader package version: %w", err)
	}
	if currentVersion != version {
		return "", fmt.Errorf("requested loader changelog version %s does not match package version %s", version, currentVersion)
	}

	versionCommits, err := gitOutput(root, defaultRunner, "log", "--format=%H", "-G", "^Version:", "--", "ios/control")
	if err != nil {
		return "", fmt.Errorf("read loader version history: %w", err)
	}
	commits := strings.Fields(versionCommits)
	if len(commits) == 0 {
		return "", errors.New("loader semantic version history is unavailable")
	}
	versionAtCommit, err := gitOutput(root, defaultRunner, "show", commits[0]+":./ios/control")
	if err != nil {
		return "", fmt.Errorf("read loader version commit: %w", err)
	}
	historicalVersion, err := packageVersionFromControl(versionAtCommit)
	if err != nil {
		return "", fmt.Errorf("read loader version commit metadata: %w", err)
	}
	if historicalVersion != version {
		return "", fmt.Errorf("latest loader version commit contains %s, expected %s", historicalVersion, version)
	}

	baseCommit := commits[0]
	if len(commits) > 1 {
		baseCommit = commits[1]
	}
	subjects, err := gitOutput(root, defaultRunner, "log", "--format=%s", "--no-merges", baseCommit+"..HEAD")
	if err != nil {
		return "", fmt.Errorf("read loader changes since the previous semantic version: %w", err)
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
