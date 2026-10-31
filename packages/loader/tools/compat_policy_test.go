package main

import (
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"
)

func TestCompareDiscordVersions(t *testing.T) {
	for _, pair := range []struct {
		left, right string
		order       int
	}{
		{"350.8", "350.8", 0},
		{"350.8", "350.10", -1},
		{"351.0", "350.99", 1},
		{"352.10 - Beta", "352.10", 0},
		{"349.5", "350.0", -1},
	} {
		if order, err := compareDiscordVersions(pair.left, pair.right); err != nil || order != pair.order {
			t.Fatalf("%s against %s: got %d (%v), want %d", pair.left, pair.right, order, err, pair.order)
		}
	}
	if _, err := compareDiscordVersions("latest", "350.8"); err == nil {
		t.Fatal("a version without a number must be rejected")
	}
}

func TestLoadCompatPolicy(t *testing.T) {
	policy, err := loadCompatPolicy("../../..")
	if err != nil {
		t.Fatal(err)
	}
	if policy.Minimum["android"] == "" || policy.Minimum["ios"] == "" || policy.ReminderDays != 30 {
		t.Fatalf("the tracked policy must set both minimums and a 30 day reminder: %+v", policy)
	}

	root := t.TempDir()
	path := filepath.Join(root, compatPolicyPath)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	for _, invalid := range []string{
		`{"minimumDiscordVersion": {"android": "350.8"}, "raiseReminderDays": 30}`,
		`{"minimumDiscordVersion": {"android": "350.8", "ios": "350.0"}}`,
		`not json`,
	} {
		if err := os.WriteFile(path, []byte(invalid), 0o644); err != nil {
			t.Fatal(err)
		}
		if _, err := loadCompatPolicy(root); err == nil {
			t.Fatalf("policy %s must be rejected", invalid)
		}
	}
}

func TestEvaluateCompatSupport(t *testing.T) {
	policy := &compatPolicy{Minimum: map[string]string{"android": "350.8", "ios": "350.0"}, ReminderDays: 30}
	now := time.Date(2026, 12, 1, 0, 0, 0, 0, time.UTC)
	android := &compatTarget{Platform: "android", Version: "351.2"}
	ios := &compatTarget{Platform: "ios", Version: "350.0"}

	fresh := evaluateCompatSupport([]*compatTarget{ios, android}, policy, nil, now)
	if fresh["android"].NewerSince != now.Format(time.RFC3339) || fresh["ios"].NewerSince != "" || fresh["ios"].Minimum != "350.0" {
		t.Fatalf("stable newer than the minimum must start the clock, and stable at the minimum must not: %+v %+v", fresh["android"], fresh["ios"])
	}

	since := "2026-10-20T06:00:00Z"
	baseline := &compatResults{Support: map[string]*compatSupport{"android": {Minimum: "350.8", NewerSince: since}}}
	kept := evaluateCompatSupport([]*compatTarget{android}, policy, baseline, now)
	if kept["android"].NewerSince != since {
		t.Fatalf("the clock must carry over from the previous scan: %+v", kept["android"])
	}

	raised := &compatPolicy{Minimum: map[string]string{"android": "351.0", "ios": "350.0"}, ReminderDays: 30}
	restarted := evaluateCompatSupport([]*compatTarget{android}, raised, baseline, now)
	if restarted["android"].NewerSince != now.Format(time.RFC3339) {
		t.Fatalf("raising the minimum must restart the clock: %+v", restarted["android"])
	}

	old := &compatTarget{Platform: "android", Version: "349.3"}
	support := evaluateCompatSupport([]*compatTarget{old}, policy, baseline, now)
	if support["android"].NewerSince != "" || !compatOlderThanSupported(old, support) {
		t.Fatalf("a build older than the minimum must be flagged: %+v", support["android"])
	}
	report := renderCompatReport(&compatResults{Targets: []*compatTarget{old}, Support: support})
	if !strings.Contains(report, "Oldest supported Discord: Android 350.8. **Android 349.3 is older than Unbound supports.**") {
		t.Fatalf("the report must call out an unsupported build:\n%s", report)
	}
}

func supportResults(androidSince, iosSince string) *compatResults {
	return &compatResults{
		Targets: []*compatTarget{{Platform: "ios", Version: "351.0"}, {Platform: "android", Version: "351.2"}},
		Support: map[string]*compatSupport{
			"ios":     {Minimum: "350.0", NewerSince: iosSince},
			"android": {Minimum: "350.8", NewerSince: androidSince},
		},
	}
}

func TestDueSupportRaises(t *testing.T) {
	now := time.Date(2026, 12, 1, 12, 0, 0, 0, time.UTC)
	results := supportResults("2026-10-31T12:00:00Z", "2026-11-01T12:00:00Z")
	raises := dueSupportRaises(results, 30, now)
	want := []compatSupportRaise{{Platform: "android", Minimum: "350.8", Stable: "351.2", NewerSince: time.Date(2026, 10, 31, 12, 0, 0, 0, time.UTC)}}
	if !reflect.DeepEqual(raises, want) {
		t.Fatalf("only a stable build newer for more than 30 days is due: got %+v", raises)
	}
	if got := dueSupportRaises(supportResults("", ""), 30, now); len(got) != 0 {
		t.Fatalf("stable at the minimum is never due: %+v", got)
	}
	if title := compatSupportIssueTitle(want); title != "Raise the oldest supported Discord (Android 350.8 to 351.2)" {
		t.Fatalf("unexpected title %q", title)
	}
}

func TestRenderCompatSupportIssue(t *testing.T) {
	since := time.Date(2026, 10, 31, 12, 0, 0, 0, time.UTC)
	android := compatSupportRaise{Platform: "android", Minimum: "350.8", Stable: "351.2", NewerSince: since}
	ios := compatSupportRaise{Platform: "ios", Minimum: "350.0", Stable: "351.0", NewerSince: since}
	names := []compatLegacyName{{Name: "com.discord.theme.ThemeManager", Locations: []compatLocation{{File: "Themes.kt", Line: 4}}}}

	body := renderCompatSupportIssue([]compatSupportRaise{android}, names, 30, "https://github.com/unbound-app/unbound/blob/abc")
	for _, line := range []string{
		"[`packages/loader/compat-policy.json`](https://github.com/unbound-app/unbound/blob/abc/packages/loader/compat-policy.json)",
		"newer than that minimum for more than 30 days",
		"| Android | 350.8 | 351.2 | 2026-10-31 |",
		"- class `com.discord.theme.ThemeManager` · [Themes.kt:4](https://github.com/unbound-app/unbound/blob/abc/Themes.kt#L4)",
	} {
		if !strings.Contains(body, line) {
			t.Fatalf("issue body is missing %q:\n%s", line, body)
		}
	}

	iosOnly := renderCompatSupportIssue([]compatSupportRaise{ios}, names, 30, "")
	if strings.Contains(iosOnly, "ThemeManager") || !strings.Contains(iosOnly, "removes nothing yet") {
		t.Fatalf("Android legacy names only follow an Android raise:\n%s", iosOnly)
	}
}

func TestPlanCompatSupportIssue(t *testing.T) {
	open := []compatIssue{
		{Number: 40, Title: "Raise the oldest supported Discord (Android 350.8 to 351.0)"},
		{Number: 44, Title: "Raise the oldest supported Discord (Android 350.8 to 351.2)"},
		{Number: 12, Title: "Discord compatibility (stable): iOS 351.0, Android 351.2"},
	}
	raises := []compatSupportRaise{{Platform: "android", Minimum: "350.8", Stable: "351.4"}}

	current := planCompatSupportIssue(open, raises)
	if current.Update != 44 || current.Create || current.Title != "Raise the oldest supported Discord (Android 350.8 to 351.4)" || !reflect.DeepEqual(current.Close, []compatIssueClose{{Number: 40}}) {
		t.Fatalf("one issue must stay open and follow stable: %+v", current)
	}

	fresh := planCompatSupportIssue(open[2:], raises)
	if !fresh.Create || fresh.Update != 0 || len(fresh.Close) != 0 {
		t.Fatalf("a due raise without an issue must open one: %+v", fresh)
	}

	done := planCompatSupportIssue(open, nil)
	comment := supportCurrentComment()
	if done.Create || done.Update != 0 || !reflect.DeepEqual(done.Close, []compatIssueClose{{Number: 44, Comment: comment}, {Number: 40, Comment: comment}}) {
		t.Fatalf("a raised minimum must close the reminder: %+v", done)
	}

	fake := &fakeGitHub{created: 50}
	if _, err := applyCompatIssuePlan(fake, "unbound-app/unbound", compatSupportLabel, "body.md", fresh); err != nil {
		t.Fatal(err)
	}
	if want := []string{"create Raise the oldest supported Discord (Android 350.8 to 351.4) [discord-support-policy]"}; !reflect.DeepEqual(fake.actions, want) {
		t.Fatalf("got %v, want %v", fake.actions, want)
	}
}
