package main

import (
	"reflect"
	"strconv"
	"strings"
	"testing"
)

type fakeGitHub struct {
	created int
	actions []string
}

func (fake *fakeGitHub) openIssues(string, string) ([]compatIssue, error) { return nil, nil }

func (fake *fakeGitHub) updateIssue(_ string, number int, title, _ string) error {
	fake.actions = append(fake.actions, "update #"+strconv.Itoa(number)+" "+title)
	return nil
}

func (fake *fakeGitHub) createIssue(_ string, title, label, _ string) (int, error) {
	fake.actions = append(fake.actions, "create "+title+" ["+label+"]")
	return fake.created, nil
}

func (fake *fakeGitHub) closeIssue(_ string, number int, comment string) error {
	fake.actions = append(fake.actions, "close #"+strconv.Itoa(number)+" "+comment)
	return nil
}

func TestPlanCompatIssue(t *testing.T) {
	open := []compatIssue{
		{Number: 12, Title: "Discord compatibility (stable): iOS 350.0, Android 350.1"},
		{Number: 15, Title: "Discord compatibility (stable): iOS 351.0, Android 350.8"},
		{Number: 14, Title: "Discord compatibility (beta): iOS 352.0, Android 352.1"},
		{Number: 9, Title: "Unrelated"},
	}

	same := planCompatIssue(open, "stable", "iOS 351.0, Android 350.8", true)
	if same.Update != 15 || same.Create || !reflect.DeepEqual(same.Close, []compatIssueClose{{Number: 12}}) {
		t.Fatalf("an issue with the same versions must be updated and the older one superseded: %+v", same)
	}

	newer := planCompatIssue(open, "stable", "iOS 352.0, Android 351.0", true)
	if newer.Update != 0 || !newer.Create || !reflect.DeepEqual(newer.Close, []compatIssueClose{{Number: 15}, {Number: 12}}) {
		t.Fatalf("new versions must create an issue and supersede every open one for the channel: %+v", newer)
	}

	clean := planCompatIssue(open, "stable", "iOS 352.0, Android 351.0", false)
	want := resolvedComment("iOS 352.0, Android 351.0")
	if clean.Update != 0 || clean.Create || !reflect.DeepEqual(clean.Close, []compatIssueClose{{Number: 15, Comment: want}, {Number: 12, Comment: want}}) {
		t.Fatalf("a clean scan must close every open compat issue for the channel: %+v", clean)
	}
	if !strings.Contains(want, "reports no breakages") || !strings.Contains(want, "iOS 352.0, Android 351.0") {
		t.Fatalf("unexpected resolved comment %q", want)
	}
}

func TestApplyCompatIssuePlan(t *testing.T) {
	fake := &fakeGitHub{created: 21}
	plan := planCompatIssue([]compatIssue{{Number: 15, Title: "Discord compatibility (beta): iOS 1, Android 1"}}, "beta", "iOS 2, Android 2", true)
	number, err := applyCompatIssuePlan(fake, "unbound-app/unbound", compatIssueLabel, "report.md", plan)
	if err != nil || number != 21 {
		t.Fatalf("got #%d, %v", number, err)
	}
	want := []string{"create Discord compatibility (beta): iOS 2, Android 2 [discord-compat]", "close #15 Superseded by #21"}
	if !reflect.DeepEqual(fake.actions, want) {
		t.Fatalf("got %v, want %v", fake.actions, want)
	}
}

func TestCompatIssueVersions(t *testing.T) {
	results := &compatResults{Targets: []*compatTarget{{Platform: "ios", Version: "351.0"}, {Platform: "android", Version: "350.8"}}}
	if got := compatIssueVersions(results); got != "iOS 351.0, Android 350.8" {
		t.Fatalf("unexpected versions %q", got)
	}
}
