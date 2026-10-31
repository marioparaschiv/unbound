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

const crashExcerptLimit = 20

var fatalLogLine = regexp.MustCompile(`FATAL EXCEPTION|Fatal signal|exited due to signal|AndroidRuntime: FATAL|Terminating app due to|EXC_(BAD_ACCESS|CRASH)`)

func smokeFailures(report string) []string {
	_, after, found := strings.Cut(report, "Failed:\n")
	if !found {
		return nil
	}
	var failures []string
	for _, line := range strings.Split(after, "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" && len(failures) > 0 {
			break
		}
		if strings.HasPrefix(trimmed, "- ") {
			failures = append(failures, trimmed)
		}
	}
	return failures
}

func crashExcerpt(log string) []string {
	lines := strings.Split(log, "\n")
	for index, line := range lines {
		if fatalLogLine.MatchString(line) {
			start := max(index-crashExcerptLimit/2, 0)
			end := min(start+crashExcerptLimit, len(lines))
			return lines[start:end]
		}
	}
	return nil
}

func renderSmokeFailureSummary(report, log string) string {
	failures := smokeFailures(report)
	if len(failures) == 0 {
		return ""
	}
	var markdown strings.Builder
	markdown.WriteString("## Smoke test failures\n\n")
	markdown.WriteString(strings.Join(failures, "\n"))
	markdown.WriteString("\n\n")
	if excerpt := crashExcerpt(log); len(excerpt) > 0 {
		markdown.WriteString("First crash in the device log:\n\n```\n")
		markdown.WriteString(strings.TrimRight(strings.Join(excerpt, "\n"), "\n"))
		markdown.WriteString("\n```\n\n")
	}
	return markdown.String()
}

func readOptional(path string) string {
	data, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	return string(data)
}

func runSmokeFailureSummary(args []string) error {
	set := flag.NewFlagSet("smoke-failure-summary", flag.ContinueOnError)
	artifacts := set.String("artifacts", "", "downloaded smoke test artifact directory")
	output := set.String("output", "", "markdown file to write the summary to")
	if err := set.Parse(args); err != nil {
		return err
	}
	if *artifacts == "" || *output == "" {
		return errors.New("usage: smoke-failure-summary --artifacts <dir> --output <file>")
	}
	log := readOptional(filepath.Join(*artifacts, "android-log.txt"))
	if log == "" {
		log = readOptional(filepath.Join(*artifacts, "ios-log.txt"))
	}
	summary := renderSmokeFailureSummary(readOptional(filepath.Join(*artifacts, "report.md")), log)
	if err := os.WriteFile(*output, []byte(summary+readOptional(filepath.Join(*artifacts, "comparison.md"))), 0o644); err != nil {
		return err
	}
	fmt.Printf("wrote %s\n", *output)
	return nil
}
