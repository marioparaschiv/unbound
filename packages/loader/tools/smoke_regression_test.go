package main

import (
	"strings"
	"testing"
)

func baselineRecords(bundle, plugins, moyai float64, count int) []smokeStartupRecord {
	records := []smokeStartupRecord{}
	for index := 0; index < count; index++ {
		records = append(records, smokeStartupRecord{BundleMs: bundle + float64(index), PluginsMs: plugins, Plugins: map[string]float64{"unbound.moyai": moyai}})
	}
	return records
}

func TestStartupRegressionsFlagOnlyClearSlowdowns(t *testing.T) {
	baseline := baselineRecords(10000, 5000, 20, 5)
	steady := smokeStartupRecord{BundleMs: 11000, PluginsMs: 5500, Plugins: map[string]float64{"unbound.moyai": 25}}
	if got := startupRegressions(steady, baseline); len(got) != 0 {
		t.Fatalf("normal noise must not be flagged: %+v", got)
	}
	slow := smokeStartupRecord{BundleMs: 20000, PluginsMs: 5600, Plugins: map[string]float64{"unbound.moyai": 200, "unbound.new": 900}}
	got := startupRegressions(slow, baseline)
	if len(got) != 2 || got[0].name != "Unbound's bundle" || got[1].name != "`unbound.moyai`" {
		t.Fatalf("expected the bundle and moyai to be flagged, got %+v", got)
	}
}

func TestRegressionReportNeedsHistory(t *testing.T) {
	report := renderRegressionReport(smokeStartupRecord{BundleMs: 1}, baselineRecords(10, 10, 1, 2))
	if !strings.Contains(report.markdown, "nothing to compare against yet") || len(report.warnings) != 0 {
		t.Fatalf("unexpected report %+v", report)
	}
}

func TestRegressionReportWarnsWithMedians(t *testing.T) {
	report := renderRegressionReport(smokeStartupRecord{BundleMs: 30000, PluginsMs: 5000}, baselineRecords(10000, 5000, 20, 3))
	if len(report.warnings) != 1 || !strings.Contains(report.warnings[0].message, "against a median of 10001 ms") {
		t.Fatalf("unexpected warnings %v", report.warnings)
	}
	if !strings.Contains(report.markdown, "| Unbound's bundle executed | 30.0s | 10.0s |") {
		t.Fatalf("unexpected table:\n%s", report.markdown)
	}
}

func TestStartupRecordCarriesPluginTimes(t *testing.T) {
	ms := 12.5
	result := &smokeResult{statuses: []smokePluginStatus{{ID: "unbound.moyai", StartMs: &ms}, {ID: "unbound.old"}}}
	record := startupRecord(result)
	if len(record.Plugins) != 1 || record.Plugins["unbound.moyai"] != 12.5 {
		t.Fatalf("unexpected record %+v", record)
	}
}
