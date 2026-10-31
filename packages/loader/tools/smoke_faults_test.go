package main

import (
	"strings"
	"testing"
)

func TestFaultProblemsNameEachFailedCheck(t *testing.T) {
	faults := []smokeFaultResult{
		{Name: "throw on start", Observed: "failed with boom"},
		{Name: "freeze on start", Problem: "a plugin that froze Discord twice was not disabled"},
		{Problem: "the fault check could not run: timeout"},
	}
	problems := faultProblems(faults)
	if len(problems) != 2 || problems[0] != "freeze on start: a plugin that froze Discord twice was not disabled" || problems[1] != "fault check: the fault check could not run: timeout" {
		t.Fatalf("unexpected problems %v", problems)
	}
	report := renderSmokeFaults(faults)
	if !strings.Contains(report, "| throw on start | failed with boom |") || !strings.Contains(report, "**a plugin that froze Discord twice was not disabled**") {
		t.Fatalf("fault table missing:\n%s", report)
	}
}

func TestSmokeFaultExpressionsUseTheCrashFixture(t *testing.T) {
	for _, expression := range []string{smokeCrashArmExpression, smokeCrashCheckExpression} {
		if !strings.Contains(expression, "'"+smokeCrashFixtureID+"'") {
			t.Fatalf("an expression does not name the crash fixture:\n%s", expression)
		}
	}
	if !strings.Contains(smokeCrashArmExpression, "unbound.storage.persist()") {
		t.Fatal("the crash fixture must persist its consent and state before it crashes Discord")
	}
}
