package workflowtests

import (
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"slices"
	"strings"
	"testing"

	"gopkg.in/yaml.v3"
)

type workflowNeeds []string

func (needs *workflowNeeds) UnmarshalYAML(node *yaml.Node) error {
	if node.Kind == yaml.ScalarNode {
		*needs = []string{node.Value}
		return nil
	}
	var list []string
	if err := node.Decode(&list); err != nil {
		return err
	}
	*needs = list
	return nil
}

type workflowStep struct {
	Name string            `yaml:"name"`
	ID   string            `yaml:"id"`
	If   string            `yaml:"if"`
	Uses string            `yaml:"uses"`
	Run  string            `yaml:"run"`
	With map[string]string `yaml:"with"`
	Env  map[string]string `yaml:"env"`
}

type workflowJob struct {
	Needs   workflowNeeds     `yaml:"needs"`
	If      string            `yaml:"if"`
	Uses    string            `yaml:"uses"`
	With    map[string]string `yaml:"with"`
	Outputs map[string]string `yaml:"outputs"`
	Steps   []workflowStep    `yaml:"steps"`
}

type parsedWorkflow struct {
	Jobs map[string]workflowJob `yaml:"jobs"`
}

func workflowsDirectory(t *testing.T) string {
	t.Helper()
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not locate test source")
	}
	return filepath.Join(filepath.Dir(filename), "..", "..", "..", ".github", "workflows")
}

func loadWorkflow(t *testing.T, name string) parsedWorkflow {
	t.Helper()
	data, err := os.ReadFile(filepath.Join(workflowsDirectory(t), name))
	if err != nil {
		t.Fatal(err)
	}
	var workflow parsedWorkflow
	if err := yaml.Unmarshal(data, &workflow); err != nil {
		t.Fatalf("%s: %v", name, err)
	}
	return workflow
}

func (workflow parsedWorkflow) job(t *testing.T, name string) workflowJob {
	t.Helper()
	job, ok := workflow.Jobs[name]
	if !ok {
		t.Fatalf("workflow has no %s job", name)
	}
	return job
}

func (job workflowJob) step(t *testing.T, name string) workflowStep {
	t.Helper()
	for _, step := range job.Steps {
		if step.Name == name {
			return step
		}
	}
	t.Fatalf("job has no %q step", name)
	return workflowStep{}
}

func requireNeeds(t *testing.T, label string, job workflowJob, needs ...string) {
	t.Helper()
	for _, need := range needs {
		if !slices.Contains(job.Needs, need) {
			t.Fatalf("%s must need %s, needs %v", label, need, job.Needs)
		}
	}
}

func TestParsedReleaseBuildsWaitForTheGate(t *testing.T) {
	build := loadWorkflow(t, "loader-build.yml")
	gate := build.job(t, "compat-gate")
	requireNeeds(t, "compat-gate", gate, "resolve-source")
	if gate.If != "inputs.release == true && needs.resolve-source.result == 'success'" {
		t.Fatalf("the gate must run for every successful release resolution, runs if %q", gate.If)
	}
	if !strings.Contains(gate.step(t, "Check the release for breakages").Run, "--fail-on-breakage") {
		t.Fatal("the gate must fail on breakages")
	}
	for _, name := range []string{"ios", "android"} {
		job := build.job(t, name)
		requireNeeds(t, name, job, "resolve-source", "compat-gate")
		if !strings.Contains(job.If, "(needs.compat-gate.result == 'success' || needs.compat-gate.result == 'skipped')") {
			t.Fatalf("the %s build must not run after a failed gate, runs if %q", name, job.If)
		}
	}
	for _, name := range []string{"release", "android-prerelease", "publish-app-repo"} {
		job := build.job(t, name)
		if !slices.Contains(job.Needs, "ios") && !slices.Contains(job.Needs, "android") {
			t.Fatalf("%s must publish only after a gated build, needs %v", name, job.Needs)
		}
	}
}

func TestParsedIOSBuildReusesTheResolvedIPA(t *testing.T) {
	build := loadWorkflow(t, "loader-build.yml")
	keep := build.job(t, "resolve-source").step(t, "Keep the source IPA for the gate and the iOS build")
	if keep.With["name"] != "discord-source-ipa" || keep.If != "steps.select.outputs.platform == 'ios'" {
		t.Fatalf("resolve-source must keep every iOS source IPA as discord-source-ipa, got %+v", keep)
	}
	ios := build.job(t, "ios")
	if ios.Uses != "./.github/workflows/loader-ios.yml" || ios.With["source_ipa_artifact"] != "${{ needs.resolve-source.result == 'success' && 'discord-source-ipa' || '' }}" {
		t.Fatalf("the iOS build must receive the resolved IPA, got %+v", ios.With)
	}

	source := loadWorkflow(t, "loader-ios.yml").job(t, "resolve-source-ipa")
	download := source.step(t, "Download the resolved source ipa")
	if download.If != "inputs.source_ipa_artifact != ''" || download.With["name"] != "${{ inputs.source_ipa_artifact }}" {
		t.Fatalf("the iOS build must download the resolved IPA when given one, got %+v", download)
	}
	for _, name := range []string{"Decrypt the source ipa", "Download the source ipa"} {
		if step := source.step(t, name); !strings.HasPrefix(step.If, "inputs.source_ipa_artifact == '' && ") {
			t.Fatalf("%q must only run without a resolved IPA, runs if %q", name, step.If)
		}
	}
	for _, output := range []string{"channel", "is_testflight", "version", "cache_hit"} {
		if !strings.HasPrefix(source.Outputs[output], "${{ steps.reuse.outputs."+output+" || ") {
			t.Fatalf("output %s must prefer the reused IPA, got %q", output, source.Outputs[output])
		}
	}
}

func TestParsedTestflightPollResolvesWithoutDownloading(t *testing.T) {
	candidate := loadWorkflow(t, "loader-release-poll.yml").job(t, "testflight-candidate")
	resolve := candidate.step(t, "Resolve the latest TestFlight build")
	if resolve.With["resolve-only"] != "true" || resolve.With["channel"] != "testflight" || resolve.With["output"] != "" {
		t.Fatalf("the TestFlight poll must resolve without downloading, got %+v", resolve.With)
	}
	check := candidate.step(t, "Resolve TestFlight candidate")
	if check.Env["TESTFLIGHT_VERSION"] != "${{ steps.testflight.outputs.version }}" || !strings.Contains(check.Run, `--version "$TESTFLIGHT_VERSION"`) {
		t.Fatalf("the candidate must come from the resolved version, got %+v", check)
	}
}

func TestParsedDkryptStepsShareOnePinnedRelease(t *testing.T) {
	entries, err := os.ReadDir(workflowsDirectory(t))
	if err != nil {
		t.Fatal(err)
	}
	pinned := regexp.MustCompile(`^castdrian/dkrypt@v[0-9]+\.[0-9]+\.[0-9]+$`)
	refs := map[string]bool{}
	for _, entry := range entries {
		if filepath.Ext(entry.Name()) != ".yml" {
			continue
		}
		for jobName, job := range loadWorkflow(t, entry.Name()).Jobs {
			for _, step := range job.Steps {
				if !strings.Contains(step.Uses, "castdrian/dkrypt") {
					continue
				}
				if !pinned.MatchString(step.Uses) {
					t.Fatalf("%s %s %q must use a released version of the dkrypt action, uses %q", entry.Name(), jobName, step.Name, step.Uses)
				}
				if step.With["api-key"] != "${{ secrets.DKRYPT_API_KEY }}" {
					t.Fatalf("%s %s %q must authenticate with the DKRYPT_API_KEY secret", entry.Name(), jobName, step.Name)
				}
				refs[step.Uses] = true
			}
		}
	}
	if len(refs) != 1 {
		t.Fatalf("every dkrypt step must use the same release, found %v", refs)
	}
}

func TestParsedCompatScansDoNotCancelEachOther(t *testing.T) {
	data, err := os.ReadFile(filepath.Join(workflowsDirectory(t), "discord-compat.yml"))
	if err != nil {
		t.Fatal(err)
	}
	var workflow struct {
		Concurrency struct {
			Group string `yaml:"group"`
		} `yaml:"concurrency"`
	}
	if err := yaml.Unmarshal(data, &workflow); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(workflow.Concurrency.Group, "inputs.channel") {
		t.Fatalf("dispatched channels must not share one concurrency group, group is %q", workflow.Concurrency.Group)
	}
}

func TestParsedAndroidBuildRunsTheModuleUnitTests(t *testing.T) {
	module := loadWorkflow(t, "loader-android.yml").job(t, "build-module")
	test := module.step(t, "Test module")
	if !strings.Contains(test.Run, ":module:testDebugUnitTest") {
		t.Fatalf("the module build must run the Kotlin unit tests, runs %q", test.Run)
	}
}

func TestOnlyTheStableScanTracksRemovableLegacyNames(t *testing.T) {
	data, err := os.ReadFile(filepath.Join(workflowsDirectory(t), "discord-compat.yml"))
	if err != nil {
		t.Fatal(err)
	}
	var workflow parsedWorkflow
	if err := yaml.Unmarshal(data, &workflow); err != nil {
		t.Fatal(err)
	}
	var steps []workflowStep
	for _, step := range workflow.Jobs["scan"].Steps {
		if strings.Contains(step.Run, "go run ./tools compat-legacy-issue") {
			steps = append(steps, step)
		}
	}
	if len(steps) != 1 {
		t.Fatalf("the scan job must have one legacy cleanup step, found %d", len(steps))
	}
	step := steps[0]
	if !strings.Contains(step.If, "matrix.channel == 'stable'") || !strings.Contains(step.If, "github.ref_name == github.event.repository.default_branch") {
		t.Fatalf("only the default branch's stable scan may drive the cleanup issue, the step runs if %q", step.If)
	}
	if !strings.Contains(step.Run, "--results compat.json") || !strings.Contains(step.Run, "gh label create discord-compat-cleanup") {
		t.Fatalf("the cleanup step must read the stable scan and label its issue: %s", step.Run)
	}
}
