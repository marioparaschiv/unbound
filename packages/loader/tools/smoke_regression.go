package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

const (
	smokeStartupFile         = "startup.json"
	regressionRatio          = 1.25
	regressionMinimumMs      = 2000
	pluginRegressionRatio    = 1.5
	pluginRegressionMinimum  = 50
	regressionMinimumSamples = 3
)

type smokeStartupRecord struct {
	BundleMs  float64             `json:"bundleMs,omitempty"`
	PluginsMs float64             `json:"pluginsMs,omitempty"`
	Plugins   map[string]float64  `json:"plugins,omitempty"`
	Console   []smokeConsoleEntry `json:"console"`
	Resources *smokeResources     `json:"resources,omitempty"`
	Recorded  bool                `json:"consoleRecorded,omitempty"`
}

type startupRegression struct {
	name     string
	current  float64
	baseline float64
}

func startupRecord(result *smokeResult) smokeStartupRecord {
	record := smokeStartupRecord{
		BundleMs:  float64(result.startup.bundle.Milliseconds()),
		PluginsMs: float64(result.startup.plugins.Milliseconds()),
		Plugins:   map[string]float64{},
		Console:   append([]smokeConsoleEntry{}, result.console...),
		Resources: result.resources,
		Recorded:  true,
	}
	for _, status := range result.statuses {
		if status.StartMs != nil {
			record.Plugins[status.ID] = *status.StartMs
		}
	}
	return record
}

func runSmokeRegression(args []string) error {
	set := flag.NewFlagSet("smoke-regression", flag.ContinueOnError)
	current := set.String("current", "", "startup.json from this run's smoke test")
	repository := set.String("repo", os.Getenv("GITHUB_REPOSITORY"), "owner/name to read the baseline runs from")
	workflow := set.String("workflow", "loader-build.yml", "workflow whose default-branch runs are the baseline")
	branch := set.String("branch", "main", "branch whose runs are the baseline")
	artifact := set.String("artifact", "android smoke test", "smoke artifact name in those runs")
	consoleOnly := set.Bool("console-only", false, "compare only console errors and warnings, not startup times")
	runs := set.Int("runs", 10, "how many recent successful runs to compare against")
	summary := set.String("summary", os.Getenv("GITHUB_STEP_SUMMARY"), "markdown file to append the comparison to")
	if err := set.Parse(args); err != nil {
		return err
	}
	if *current == "" || *repository == "" {
		return errors.New("usage: smoke-regression --current <startup.json> --repo <owner/name> [--workflow <file>] [--artifact <name>]")
	}
	record, err := readStartupRecord(*current)
	if err != nil {
		return err
	}
	baseline, err := baselineStartupRecords(*repository, *workflow, *branch, *artifact, *runs)
	if err != nil {
		return err
	}
	report := renderConsoleReport(record, baseline)
	if !*consoleOnly {
		startup := renderRegressionReport(record, baseline)
		resources := renderResourceReport(record, baseline)
		report = regressionReport{
			markdown: startup.markdown + resources.markdown + report.markdown,
			warnings: append(append(startup.warnings, resources.warnings...), report.warnings...),
		}
	}
	fmt.Print(report.markdown)
	for _, warning := range report.warnings {
		fmt.Printf("::warning title=%s::%s\n", warning.title, warning.message)
	}
	if *summary != "" {
		if file, err := os.OpenFile(*summary, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644); err == nil {
			_, _ = file.WriteString(report.markdown)
			file.Close()
		}
	}
	return nil
}

func readStartupRecord(path string) (smokeStartupRecord, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return smokeStartupRecord{}, err
	}
	var record smokeStartupRecord
	if err := json.Unmarshal(data, &record); err != nil {
		return smokeStartupRecord{}, fmt.Errorf("read %s: %w", path, err)
	}
	return record, nil
}

func baselineStartupRecords(repository, workflow, branch, artifact string, limit int) ([]smokeStartupRecord, error) {
	output, err := exec.Command("gh", "run", "list", "--repo", repository, "--workflow", workflow, "--branch", branch, "--status", "success", "--limit", strconv.Itoa(limit), "--json", "databaseId", "--jq", ".[].databaseId").Output()
	if err != nil {
		return nil, fmt.Errorf("list %s runs on %s: %w", workflow, branch, err)
	}
	records := []smokeStartupRecord{}
	for _, id := range strings.Fields(string(output)) {
		directory, err := os.MkdirTemp("", "smoke-baseline-")
		if err != nil {
			return nil, err
		}
		if exec.Command("gh", "run", "download", id, "--repo", repository, "--name", artifact, "--dir", directory).Run() == nil {
			if record, err := readStartupRecord(filepath.Join(directory, smokeStartupFile)); err == nil && (record.BundleMs > 0 || record.Recorded) {
				records = append(records, record)
			}
		}
		os.RemoveAll(directory)
	}
	return records, nil
}

type regressionWarning struct {
	title   string
	message string
}

type regressionReport struct {
	markdown string
	warnings []regressionWarning
}

func renderConsoleReport(current smokeStartupRecord, baseline []smokeStartupRecord) regressionReport {
	var markdown strings.Builder
	markdown.WriteString("## Console compared with main\n\n")
	recorded := []smokeStartupRecord{}
	for _, record := range baseline {
		if record.Recorded {
			recorded = append(recorded, record)
		}
	}
	if !current.Recorded || len(recorded) < regressionMinimumSamples {
		fmt.Fprintf(&markdown, "Only %d recent main runs recorded console messages, so there is nothing to compare against yet.\n\n", len(recorded))
		return regressionReport{markdown: markdown.String()}
	}
	fresh := newConsoleEntries(current.Console, recorded)
	if len(fresh) == 0 {
		fmt.Fprintf(&markdown, "No console error or warning that the last %d main runs did not also log.\n\n", len(recorded))
		return regressionReport{markdown: markdown.String()}
	}
	fmt.Fprintf(&markdown, "Logged here but in none of the last %d main runs:\n\n| Level | Message |\n| --- | --- |\n", len(recorded))
	warnings := []regressionWarning{}
	for _, entry := range fresh {
		fmt.Fprintf(&markdown, "| %s | `%s` |\n", entry.Level, strings.ReplaceAll(entry.Message, "|", "\\|"))
		warnings = append(warnings, regressionWarning{title: "New console " + entry.Level, message: entry.Message})
	}
	markdown.WriteString("\n")
	return regressionReport{markdown: markdown.String(), warnings: warnings}
}

func renderRegressionReport(current smokeStartupRecord, baseline []smokeStartupRecord) regressionReport {
	var markdown strings.Builder
	markdown.WriteString("## Startup compared with main\n\n")
	if len(baseline) < regressionMinimumSamples {
		fmt.Fprintf(&markdown, "Only %d recent main runs recorded startup times, so there is nothing to compare against yet.\n\n", len(baseline))
		return regressionReport{markdown: markdown.String()}
	}
	regressions := startupRegressions(current, baseline)
	fmt.Fprintf(&markdown, "| Milestone | This run | Median of %d main runs |\n| --- | --- | --- |\n", len(baseline))
	fmt.Fprintf(&markdown, "| Unbound's bundle executed | %.1fs | %.1fs |\n", current.BundleMs/1000, medianOf(baseline, func(record smokeStartupRecord) (float64, bool) { return record.BundleMs, record.BundleMs > 0 })/1000)
	fmt.Fprintf(&markdown, "| Every plugin loaded | %.1fs | %.1fs |\n\n", current.PluginsMs/1000, medianOf(baseline, func(record smokeStartupRecord) (float64, bool) { return record.PluginsMs, record.PluginsMs > 0 })/1000)
	if len(regressions) == 0 {
		markdown.WriteString("No startup regression.\n\n")
		return regressionReport{markdown: markdown.String()}
	}
	warnings := []regressionWarning{}
	markdown.WriteString("Slower than main:\n\n")
	for _, regression := range regressions {
		line := fmt.Sprintf("%s took %.0f ms against a median of %.0f ms", regression.name, regression.current, regression.baseline)
		fmt.Fprintf(&markdown, "- %s\n", line)
		warnings = append(warnings, regressionWarning{title: "Startup regression", message: line})
	}
	markdown.WriteString("\n")
	return regressionReport{markdown: markdown.String(), warnings: warnings}
}

func startupRegressions(current smokeStartupRecord, baseline []smokeStartupRecord) []startupRegression {
	regressions := []startupRegression{}
	check := func(name string, value float64, read func(smokeStartupRecord) (float64, bool), ratio, minimum float64) {
		median := medianOf(baseline, read)
		if value > 0 && median > 0 && value > median*ratio && value-median > minimum {
			regressions = append(regressions, startupRegression{name: name, current: value, baseline: median})
		}
	}
	check("Unbound's bundle", current.BundleMs, func(record smokeStartupRecord) (float64, bool) { return record.BundleMs, record.BundleMs > 0 }, regressionRatio, regressionMinimumMs)
	check("Loading every plugin", current.PluginsMs, func(record smokeStartupRecord) (float64, bool) { return record.PluginsMs, record.PluginsMs > 0 }, regressionRatio, regressionMinimumMs)
	ids := make([]string, 0, len(current.Plugins))
	for id := range current.Plugins {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	for _, id := range ids {
		check("`"+id+"`", current.Plugins[id], func(record smokeStartupRecord) (float64, bool) {
			value, ok := record.Plugins[id]
			return value, ok
		}, pluginRegressionRatio, pluginRegressionMinimum)
	}
	return regressions
}

func medianOf(records []smokeStartupRecord, read func(smokeStartupRecord) (float64, bool)) float64 {
	values := []float64{}
	for _, record := range records {
		if value, ok := read(record); ok {
			values = append(values, value)
		}
	}
	if len(values) < regressionMinimumSamples {
		return 0
	}
	sort.Float64s(values)
	middle := len(values) / 2
	if len(values)%2 == 0 {
		return (values[middle-1] + values[middle]) / 2
	}
	return values[middle]
}
