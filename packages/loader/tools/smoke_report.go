package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

func smokeProblems(result *smokeResult) []string {
	var problems []string
	problems = append(problems, result.problems...)
	for _, crash := range result.crashes {
		problems = append(problems, "Discord crashed: "+crash)
	}
	for _, plugin := range result.plugins {
		if !result.loaded[plugin.id] {
			problems = append(problems, fmt.Sprintf("the loader never logged Loaded %s", plugin.id))
		}
	}
	if result.count < len(result.plugins) {
		problems = append(problems, fmt.Sprintf("the loader reported %d plugins, expected %d", result.count, len(result.plugins)))
	}
	ids := make([]string, 0, len(result.failures))
	for id := range result.failures {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	for _, id := range ids {
		problems = append(problems, fmt.Sprintf("%s failed to start: %s", id, result.failures[id][0]))
	}
	problems = append(problems, startupBudgetProblems(result.startup, result.budget, result.crashes)...)
	problems = append(problems, pluginStartBudgetProblems(result.statuses, result.budget.pluginStart)...)
	if result.evalError != "" {
		problems = append(problems, "debugger check: "+result.evalError)
		return problems
	}
	problems = append(problems, cycleProblems(result.cycle)...)
	problems = append(problems, faultProblems(result.faults)...)
	byID := map[string]smokePluginStatus{}
	for _, status := range result.statuses {
		byID[status.ID] = status
	}
	for _, plugin := range result.plugins {
		status, ok := byID[plugin.id]
		switch {
		case !ok:
			problems = append(problems, fmt.Sprintf("the client does not know %s", plugin.id))
		case status.Failed || !status.Started:
			problems = append(problems, fmt.Sprintf("%s is not started: %s", plugin.id, describeSmokeStatus(status)))
		}
	}
	return problems
}

func describeSmokeStatus(status smokePluginStatus) string {
	if status.Error != "" {
		return status.Error
	}
	if status.Failed {
		return "failed"
	}
	if status.Started {
		return "started"
	}
	return "stopped"
}

func writeSmokeReport(result *smokeResult, options *smokeOptions) {
	report := renderSmokeReport(result)
	_ = os.WriteFile(filepath.Join(options.artifacts, "report.md"), []byte(report), 0o644)
	if startup, err := json.MarshalIndent(startupRecord(result), "", "\t"); err == nil {
		_ = os.WriteFile(filepath.Join(options.artifacts, smokeStartupFile), startup, 0o644)
	}
	if options.summary == "" {
		return
	}
	file, err := os.OpenFile(options.summary, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return
	}
	defer file.Close()
	_, _ = file.WriteString(report)
}

func renderSmokeReport(result *smokeResult) string {
	var report strings.Builder
	title := map[string]string{"android": "Android", "ios": "iOS"}[result.platform]
	fmt.Fprintf(&report, "## %s smoke test\n\n", title)
	if len(result.problems) == 0 {
		fmt.Fprintf(&report, "Discord loaded and started all %d first-party plugins without signing in.\n\n", len(result.plugins))
	} else {
		report.WriteString("Failed:\n\n")
		for _, problem := range result.problems {
			fmt.Fprintf(&report, "- %s\n", problem)
		}
		report.WriteString("\n")
	}
	if result.relaunch != "" {
		fmt.Fprintf(&report, "Warning: Discord crashed on the first launch and was relaunched once: `%s`\n\n", result.relaunch)
	}
	byID := map[string]smokePluginStatus{}
	for _, status := range result.statuses {
		byID[status.ID] = status
	}
	report.WriteString(renderStartupTimes(result.startup, result.budget))
	report.WriteString(renderSlowestStarts(result.statuses))
	report.WriteString(renderSmokeResources(result.resources))
	report.WriteString(renderSmokeCycle(result.cycle))
	report.WriteString(renderSmokeFaults(result.faults))
	report.WriteString("| Plugin | Loaded by the loader | Debugger status | Start |\n| --- | --- | --- | --- |\n")
	for _, plugin := range result.plugins {
		loaded := "no"
		if result.loaded[plugin.id] {
			loaded = "yes"
		}
		status := "not checked"
		if value, ok := byID[plugin.id]; ok {
			status = describeSmokeStatus(value)
		} else if len(result.statuses) > 0 {
			status = "unknown to the client"
		}
		fmt.Fprintf(&report, "| `%s` | %s | %s | %s |\n", plugin.id, loaded, status, describeStartMs(byID[plugin.id].StartMs))
	}
	report.WriteString("\n")
	return report.String()
}
