package main

import (
	"fmt"
	"sort"
	"strings"
)

const compatReportLimit = 60000

var compatPlatformLabels = map[string]string{"ios": "iOS", "android": "Android"}

func describeCompatReference(reference *compatReference) string {
	switch reference.Kind {
	case referenceModulePath:
		return "module `" + reference.Name + "`"
	case referenceStore:
		return "store `" + reference.Name + "`"
	case referenceName:
		return "component `" + reference.Name + "`"
	case referenceProps:
		return "props " + describeTerms(reference.Terms)
	case referencePrototypes:
		return "prototype " + describeTerms(reference.Terms)
	case referenceObjCClass, referenceJavaClass:
		return "class `" + reference.Name + "`"
	case referenceObjCMethod:
		if reference.Class != "" {
			return "`-[" + reference.Class + " " + reference.Name + "]`"
		}
		return "selector `" + reference.Name + "`"
	case referenceObjCIvar:
		return "ivar `" + reference.Name + "`"
	case referenceJavaMethod:
		name := reference.Name
		if reference.Class != "" {
			name = reference.Class + "." + name
		}
		if reference.Parameters != nil {
			name += "(" + strings.Join(reference.Parameters, ", ") + ")"
		}
		return "method `" + name + "`"
	case referenceJavaField:
		return "field `" + reference.Name + "`"
	}
	return "`" + reference.Name + "`"
}

type compatReportLine struct {
	component string
	text      string
}

func compatLocationLink(location compatLocation, sourceURL string) string {
	label := fmt.Sprintf("%s:%d", location.File, location.Line)
	if sourceURL == "" {
		return "`" + label + "`"
	}
	return fmt.Sprintf("[%s](%s/%s#L%d)", label, strings.TrimSuffix(sourceURL, "/"), location.File, location.Line)
}

func compatLines(findings []compatFinding, status, sourceURL string) []compatReportLine {
	type group struct {
		finding   compatFinding
		platforms []string
		isNew     bool
	}
	groups := map[string]*group{}
	var order []string
	for _, finding := range findings {
		if finding.Status != status {
			continue
		}
		identity := finding.Reference.Component + "#" + finding.Reference.key() + "#" + finding.Reason
		existing := groups[identity]
		if existing == nil {
			existing = &group{finding: finding}
			groups[identity] = existing
			order = append(order, identity)
		}
		existing.platforms = append(existing.platforms, compatPlatformLabels[finding.Platform])
		existing.isNew = existing.isNew || finding.New
	}
	lines := make([]compatReportLine, 0, len(order))
	for _, identity := range order {
		entry := groups[identity]
		reference := entry.finding.Reference
		text := "- " + describeCompatReference(reference) + " (" + strings.Join(entry.platforms, ", ") + ")"
		if entry.isNew {
			text += " **new**"
		}
		if entry.finding.Reason != "" {
			text += ": " + entry.finding.Reason
		}
		text += " · " + compatLocationLink(reference.Locations[0], sourceURL)
		if extra := len(reference.Locations) - 1; extra > 0 {
			text += fmt.Sprintf(" and %d more", extra)
		}
		lines = append(lines, compatReportLine{component: reference.Component, text: text})
	}
	sort.SliceStable(lines, func(left, right int) bool {
		return compatComponentRank(lines[left].component) < compatComponentRank(lines[right].component) ||
			compatComponentRank(lines[left].component) == compatComponentRank(lines[right].component) && lines[left].component < lines[right].component
	})
	return lines
}

func compatComponentRank(component string) int {
	switch {
	case strings.HasPrefix(component, "loader"):
		return 0
	case component == "client":
		return 1
	case component == "plugins-shared":
		return 2
	}
	return 3
}

func compatComponentTitle(component string) string {
	switch component {
	case "loader-ios":
		return "iOS loader"
	case "loader-android":
		return "Android loader"
	case "client":
		return "Client"
	case "plugins-shared":
		return "Shared plugin helpers"
	}
	return "Plugin `" + strings.TrimPrefix(component, "plugin:") + "`"
}

func writeCompatSection(builder *strings.Builder, lines []compatReportLine) {
	current := ""
	for _, line := range lines {
		if line.component != current {
			current = line.component
			builder.WriteString("\n#### " + compatComponentTitle(current) + "\n\n")
		}
		builder.WriteString(line.text + "\n")
	}
}

func compatCounts(results *compatResults, platform string) map[string]int {
	counts := map[string]int{}
	for _, finding := range results.Findings {
		if finding.Platform == platform {
			counts[finding.Status]++
		}
	}
	return counts
}

func compatHasProblems(results *compatResults) bool {
	for _, finding := range results.Findings {
		if finding.Status == compatBroken || finding.Status == compatPossible {
			return true
		}
	}
	return false
}

func compatTargetSummary(results *compatResults) string {
	var parts []string
	for _, target := range results.Targets {
		label := compatPlatformLabels[target.Platform] + " " + target.Version
		if target.Build != "" {
			label += " (" + target.Build + ")"
		}
		parts = append(parts, label)
	}
	return strings.Join(parts, " · ")
}

func renderCompatReport(results *compatResults) string {
	return renderCompatReportWithSource(results, "")
}

func renderCompatReportWithSource(results *compatResults, sourceURL string) string {
	var builder strings.Builder
	title := "Discord compatibility scan"
	if results.Channel != "" {
		title += " (" + results.Channel + ")"
	}
	builder.WriteString("## " + title + "\n\n")
	builder.WriteString(compatTargetSummary(results) + "\n\n")
	builder.WriteString("| Platform | Broken | Possibly broken | OK | Unverified |\n| --- | --- | --- | --- | --- |\n")
	for _, target := range results.Targets {
		counts := compatCounts(results, target.Platform)
		builder.WriteString(fmt.Sprintf("| %s | %d | %d | %d | %d |\n", compatPlatformLabels[target.Platform],
			counts[compatBroken], counts[compatPossible], counts[compatOK], counts[compatUnverified]))
	}

	broken := compatLines(results.Findings, compatBroken, sourceURL)
	possible := compatLines(results.Findings, compatPossible, sourceURL)
	unverified := compatLines(results.Findings, compatUnverified, sourceURL)

	if len(broken) > 0 {
		builder.WriteString("\n### Definitely broken\n\nThese names are gone from this Discord build.\n")
		writeCompatSection(&builder, broken)
	}
	if len(possible) > 0 {
		builder.WriteString("\n### Possibly broken\n\nThese names still exist, but not where the code expects them.\n")
		writeCompatSection(&builder, possible)
	}
	if len(broken) == 0 && len(possible) == 0 {
		builder.WriteString("\nEverything the scan can check still resolves.\n")
	}

	if len(unverified) > 0 {
		var section strings.Builder
		writeCompatSection(&section, unverified)
		builder.WriteString(fmt.Sprintf("\n<details><summary>Not verifiable (%d)</summary>\n\nSystem APIs, and members whose owner the scan cannot tell. They become checkable once a scan has seen them resolve.\n%s\n</details>\n", len(unverified), section.String()))
	}

	dynamic := 0
	for _, count := range results.Dynamic {
		dynamic += count
	}
	if dynamic > 0 {
		builder.WriteString(fmt.Sprintf("\n%d lookups use computed names and were not checked.\n", dynamic))
	}

	report := builder.String()
	if len(report) > compatReportLimit {
		cut := strings.LastIndex(report[:compatReportLimit], "\n- ")
		if cut < 0 {
			cut = compatReportLimit
		}
		report = report[:cut] + "\n\nThe report was cut to fit. The full report is in the workflow run's artifacts.\n"
	}
	return report
}
