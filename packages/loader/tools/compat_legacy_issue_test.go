package main

import (
	"reflect"
	"strings"
	"testing"
)

func TestRemovableLegacyNames(t *testing.T) {
	themes := compatLocation{File: "packages/loader/android/module/src/main/kotlin/app/unbound/android/Themes.kt", Line: 4}
	reactions := compatLocation{File: "packages/plugins/reaction-avatars/src/android/reactions.ts", Line: 47}
	other := compatLocation{File: "packages/plugins/demo/src/android/index.ts", Line: 2}
	references := []*compatReference{
		{Kind: referenceJavaClass, Name: "com.discord.theme.ThemeManager", Legacy: true, Component: "loader-android", Locations: []compatLocation{themes}},
		{Kind: referenceJavaClass, Name: "com.discord.theme.ThemeManager", Component: "loader-android", Locations: []compatLocation{{File: themes.File, Line: 9}}},
		{Kind: referenceJavaClass, Name: "com.discord.reactions.ReactionView", Legacy: true, Component: "plugin:reaction-avatars", Locations: []compatLocation{reactions}},
		{Kind: referenceJavaClass, Name: "com.discord.reactions.ReactionView", Component: "plugin:demo", Locations: []compatLocation{other}},
		{Kind: referenceJavaClass, Name: "com.discord.View", Legacy: true, Component: "plugin:demo", Locations: []compatLocation{other}},
	}
	results := evaluateCompat(references, []*compatTarget{compatTestTargets()[1]}, nil)

	want := []compatLegacyName{
		{Name: "com.discord.reactions.ReactionView", Locations: []compatLocation{reactions}},
		{Name: "com.discord.theme.ThemeManager", Locations: []compatLocation{themes, {File: themes.File, Line: 9}}},
	}
	if got := removableLegacyNames(results); !reflect.DeepEqual(got, want) {
		t.Fatalf("got %+v, want %+v", got, want)
	}

	body := renderCompatLegacyIssue(want, "350.8", "https://github.com/unbound-app/unbound/blob/abc")
	for _, line := range []string{
		"Discord Android 350.8 on the stable channel no longer has these names",
		"- class `com.discord.reactions.ReactionView` · [packages/plugins/reaction-avatars/src/android/reactions.ts:47](https://github.com/unbound-app/unbound/blob/abc/packages/plugins/reaction-avatars/src/android/reactions.ts#L47)",
		"- class `com.discord.theme.ThemeManager` · [" + themes.File + ":4]",
	} {
		if !strings.Contains(body, line) {
			t.Fatalf("issue body is missing %q:\n%s", line, body)
		}
	}

	if got := removableLegacyNames(evaluateCompat(references[4:], []*compatTarget{compatTestTargets()[1]}, nil)); len(got) != 0 {
		t.Fatalf("a legacy name the build still has must not be listed: %+v", got)
	}
}

func TestPlanCompatLegacyIssue(t *testing.T) {
	open := []compatIssue{
		{Number: 30, Title: "Legacy Discord names to remove (Android 350.1)"},
		{Number: 34, Title: "Legacy Discord names to remove (Android 350.8)"},
		{Number: 12, Title: "Discord compatibility (stable): iOS 351.0, Android 350.8"},
	}

	current := planCompatLegacyIssue(open, "351.0", true)
	if current.Update != 34 || current.Create || current.Title != "Legacy Discord names to remove (Android 351.0)" || !reflect.DeepEqual(current.Close, []compatIssueClose{{Number: 30}}) {
		t.Fatalf("the newest cleanup issue must be kept up to date and the others superseded: %+v", current)
	}

	fresh := planCompatLegacyIssue(open[2:], "351.0", true)
	if !fresh.Create || fresh.Update != 0 || len(fresh.Close) != 0 {
		t.Fatalf("names to remove without an open cleanup issue must open one: %+v", fresh)
	}

	done := planCompatLegacyIssue(open, "351.0", false)
	comment := legacyKeptComment("351.0")
	if done.Create || done.Update != 0 || !reflect.DeepEqual(done.Close, []compatIssueClose{{Number: 34, Comment: comment}, {Number: 30, Comment: comment}}) {
		t.Fatalf("nothing to remove must close every cleanup issue: %+v", done)
	}

	fake := &fakeGitHub{}
	if _, err := applyCompatIssuePlan(fake, "unbound-app/unbound", compatLegacyLabel, "body.md", fresh); err != nil {
		t.Fatal(err)
	}
	if want := []string{"create Legacy Discord names to remove (Android 351.0) [discord-compat-cleanup]"}; !reflect.DeepEqual(fake.actions, want) {
		t.Fatalf("got %v, want %v", fake.actions, want)
	}
}
