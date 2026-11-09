package main

import "testing"

func TestProducerOutcomeMatchesReusableWorkflowJobNames(t *testing.T) {
	jobs := []actionsJob{
		{Name: "Build Unbound / ios / build-tweak", Status: "completed", Conclusion: "failure"},
		{Name: "Build Unbound / ios / build-ipa", Status: "in_progress"},
	}
	if got := producerOutcome(jobs, "build-ipa"); got != "" {
		t.Fatalf("a running job has no outcome, got %q", got)
	}
	jobs[1] = actionsJob{Name: "Build Unbound / ios / build-ipa", Status: "completed", Conclusion: "skipped"}
	if got := producerOutcome(jobs, "build-ipa"); got != "skipped" {
		t.Fatalf("a skipped producer must fail the wait, got %q", got)
	}
	if got := producerOutcome([]actionsJob{{Name: "build-ipa", Status: "completed", Conclusion: "success"}}, "build-ipa"); got != "success" {
		t.Fatalf("a directly run workflow names the job by its id, got %q", got)
	}
	if got := producerOutcome([]actionsJob{{Name: "rebuild-ipa", Status: "completed", Conclusion: "failure"}}, "build-ipa"); got != "" {
		t.Fatalf("only the named job counts, got %q", got)
	}
}
