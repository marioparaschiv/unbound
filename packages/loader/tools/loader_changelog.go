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

const loaderChangelogLimit = 50

var loaderConventionalCommitPattern = regexp.MustCompile("(?i)^([a-z]+)(?:\\(([^)]*)\\))?(!)?:\\s*(.+)$")
var loaderChangelogPathspec = []string{".", ":(exclude)docs", ":(exclude)workflow-tests", ":(exclude)version.json", ":(exclude,glob)**/*.md", ":(exclude,glob)**/*.mdx"}

// maxLoaderChangelogLength matches MAX_CHANGELOG_LENGTH in @unbound-app/contracts; the release API rejects longer changelogs.
const maxLoaderChangelogLength = 10_000

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
	previousCommit, foundPrevious, err := loaderPreviousReleaseCommit(root, previous)
	if err != nil {
		return "", err
	}
	arguments := []string{"log", "--format=%s"}
	if foundPrevious {
		arguments = append(arguments, "-n", strconv.Itoa(loaderChangelogLimit), previousCommit+"..HEAD")
	} else {
		arguments = append(arguments, "-n", "1", "HEAD")
	}
	arguments = append(arguments, "--")
	arguments = append(arguments, loaderChangelogPathspec...)
	subjects, err := gitOutput(root, defaultRunner, arguments...)
	if err != nil {
		return "", fmt.Errorf("read loader changes since %s: %w", previous, err)
	}

	return renderLoaderChangelog(version, strings.Split(strings.TrimSpace(subjects), "\n")), nil
}

func loaderPreviousReleaseCommit(root string, previous string) (string, bool, error) {
	if previous == "" {
		return "", false, nil
	}
	tag := "loader-v" + previous
	tags, err := gitOutput(root, defaultRunner, "tag", "--list", tag)
	if err != nil {
		return "", false, fmt.Errorf("find loader release tag %s: %w", tag, err)
	}
	if strings.TrimSpace(tags) != "" {
		commit, err := gitOutput(root, defaultRunner, "rev-parse", "refs/tags/"+tag+"^{commit}")
		if err != nil {
			return "", false, fmt.Errorf("resolve loader release tag %s: %w", tag, err)
		}
		return strings.TrimSpace(commit), true, nil
	}
	version, err := parseSemanticVersion(previous)
	if err != nil || version.major != "1" || version.minor != "0" {
		return "", false, nil
	}
	legacyCount, err := strconv.Atoi(version.patch)
	if err != nil || legacyCount < 1 {
		return "", false, nil
	}
	commits, err := gitOutput(root, defaultRunner, append([]string{"rev-list", "--reverse", "HEAD", "--"}, loaderChangelogPathspec...)...)
	if err != nil {
		return "", false, fmt.Errorf("read loader release history: %w", err)
	}
	knownCommits := strings.Split(strings.TrimSpace(commits), "\n")
	if legacyCount > len(knownCommits) {
		return "", false, nil
	}
	return knownCommits[legacyCount-1], true, nil
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
	return joinLoaderChangelog(result, maxLoaderChangelogLength)
}

// joinLoaderChangelog joins lines within limit bytes, dropping the entries that overflow and noting how many.
func joinLoaderChangelog(lines []string, limit int) string {
	changelog := strings.Join(lines, "\n")
	if len(changelog) <= limit {
		return changelog
	}

	const noteReserve = 64
	kept := []string{}
	size := 0
	omitted := 0
	for _, line := range lines {
		if omitted == 0 && size+len(line)+1 <= limit-noteReserve {
			kept = append(kept, line)
			size += len(line) + 1
			continue
		}
		if strings.HasPrefix(line, "- ") {
			omitted++
		}
	}
	for len(kept) > 0 && (kept[len(kept)-1] == "" || strings.HasPrefix(kept[len(kept)-1], "## ")) {
		kept = kept[:len(kept)-1]
	}
	return strings.Join(append(kept, "", fmt.Sprintf("...and %d more changes.", omitted)), "\n")
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
