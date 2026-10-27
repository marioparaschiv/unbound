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
	Needs          workflowNeeds     `yaml:"needs"`
	If             string            `yaml:"if"`
	Uses           string            `yaml:"uses"`
	RunsOn         string            `yaml:"runs-on"`
	TimeoutMinutes int               `yaml:"timeout-minutes"`
	With           map[string]string `yaml:"with"`
	Outputs        map[string]string `yaml:"outputs"`
	Steps          []workflowStep    `yaml:"steps"`
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

func TestOnlyTheStableScanRemindsToRaiseTheMinimum(t *testing.T) {
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
		if strings.Contains(step.Run, "go run ./tools compat-support-issue") {
			steps = append(steps, step)
		}
	}
	if len(steps) != 1 {
		t.Fatalf("the scan job must have one support policy step, found %d", len(steps))
	}
	step := steps[0]
	if !strings.Contains(step.If, "matrix.channel == 'stable'") || !strings.Contains(step.If, "github.ref_name == github.event.repository.default_branch") {
		t.Fatalf("only the default branch's stable scan may drive the support policy issue, the step runs if %q", step.If)
	}
	if !strings.Contains(step.Run, "--results compat.json") || !strings.Contains(step.Run, "gh label create discord-support-policy") {
		t.Fatalf("the support policy step must read the stable scan and label its issue: %s", step.Run)
	}
}

const pullRequestRetention = "${{ github.event_name == 'pull_request' && 14 || 0 }}"

type compositeAction struct {
	Inputs map[string]struct {
		Default string `yaml:"default"`
	} `yaml:"inputs"`
	Runs struct {
		Using string         `yaml:"using"`
		Steps []workflowStep `yaml:"steps"`
	} `yaml:"runs"`
}

func workflowFiles(t *testing.T) []string {
	t.Helper()
	entries, err := os.ReadDir(workflowsDirectory(t))
	if err != nil {
		t.Fatal(err)
	}
	var names []string
	for _, entry := range entries {
		if filepath.Ext(entry.Name()) == ".yml" {
			names = append(names, entry.Name())
		}
	}
	return names
}

func loadCompositeAction(t *testing.T, name string) compositeAction {
	t.Helper()
	data, err := os.ReadFile(filepath.Join(workflowsDirectory(t), "..", "actions", name, "action.yml"))
	if err != nil {
		t.Fatal(err)
	}
	var action compositeAction
	if err := yaml.Unmarshal(data, &action); err != nil {
		t.Fatalf("%s: %v", name, err)
	}
	if action.Runs.Using != "composite" {
		t.Fatalf("%s must be a composite action, runs %q", name, action.Runs.Using)
	}
	return action
}

func (job workflowJob) stepUsing(t *testing.T, prefix string) workflowStep {
	t.Helper()
	for _, step := range job.Steps {
		if strings.HasPrefix(step.Uses, prefix) {
			return step
		}
	}
	t.Fatalf("job has no step using %s", prefix)
	return workflowStep{}
}

func TestParsedEveryJobHasATimeout(t *testing.T) {
	for _, name := range workflowFiles(t) {
		for jobName, job := range loadWorkflow(t, name).Jobs {
			if job.Uses != "" {
				continue
			}
			if job.TimeoutMinutes <= 0 || job.TimeoutMinutes > 60 {
				t.Errorf("%s %s must time out within an hour, has timeout-minutes %d", name, jobName, job.TimeoutMinutes)
			}
		}
	}
}

func TestParsedSharedSetupActionsRunAfterCheckout(t *testing.T) {
	sharedSetups := map[string]int{}
	for _, name := range workflowFiles(t) {
		for jobName, job := range loadWorkflow(t, name).Jobs {
			checkedOut := false
			for _, step := range job.Steps {
				if strings.HasPrefix(step.Uses, "actions/checkout@") {
					checkedOut = true
				}
				if !strings.HasPrefix(step.Uses, "./.github/actions/") {
					continue
				}
				if !checkedOut {
					t.Errorf("%s %s uses %s before checking out the repository", name, jobName, step.Uses)
				}
				sharedSetups[step.Uses]++
			}
		}
	}
	if sharedSetups["./.github/actions/setup-go-tools"] < 14 || sharedSetups["./.github/actions/setup-bun-deps"] < 6 {
		t.Fatalf("the Go and Bun setups must go through the shared actions, found %v", sharedSetups)
	}
}

func TestParsedWorkflowsSetUpGoAndBunOnlyThroughTheSharedActions(t *testing.T) {
	for _, name := range []string{"build-bundle.yml", "ci.yml", "loader-android.yml", "loader-build.yml", "loader-ci.yml", "loader-ios.yml", "loader-release-poll.yml", "plugins-publish.yml", "plugins.yml", "release.yml"} {
		for jobName, job := range loadWorkflow(t, name).Jobs {
			for _, step := range job.Steps {
				if strings.HasPrefix(step.Uses, "actions/setup-go@") || strings.HasPrefix(step.Uses, "oven-sh/setup-bun@") {
					t.Errorf("%s %s sets up %s directly instead of through .github/actions", name, jobName, step.Uses)
				}
			}
		}
	}
	goTools := loadCompositeAction(t, "setup-go-tools")
	if len(goTools.Runs.Steps) != 2 || !strings.HasPrefix(goTools.Runs.Steps[0].Uses, "actions/setup-go@") || goTools.Runs.Steps[0].With["go-version-file"] != "packages/loader/go.mod" || !strings.HasPrefix(goTools.Runs.Steps[1].Uses, "actions/cache@") {
		t.Fatalf("setup-go-tools must install Go and restore its cache, got %+v", goTools.Runs.Steps)
	}
	bun := loadCompositeAction(t, "setup-bun-deps")
	for input, value := range map[string]string{"bun-version": "", "install": "true", "frozen-lockfile": "false"} {
		if declared, ok := bun.Inputs[input]; !ok || declared.Default != value {
			t.Fatalf("setup-bun-deps input %s must default to %q, got %+v", input, value, bun.Inputs)
		}
	}
	if bun.Runs.Steps[1].With["key"] != "bun-${{ runner.os }}-${{ hashFiles('bun.lock') }}" {
		t.Fatalf("setup-bun-deps must key its cache on bun.lock, got %+v", bun.Runs.Steps[1].With)
	}
	for _, name := range []string{"plugins.yml", "plugins-publish.yml"} {
		for _, job := range loadWorkflow(t, name).Jobs {
			if step := job.stepUsing(t, "./.github/actions/setup-bun-deps"); step.With["frozen-lockfile"] != "true" {
				t.Fatalf("%s must keep installing with a frozen lockfile, got %+v", name, step.With)
			}
		}
	}
	syncLock := loadWorkflow(t, "release.yml").job(t, "release").stepUsing(t, "./.github/actions/setup-bun-deps")
	if syncLock.With["install"] != "false" || syncLock.With["bun-version"] != "canary" {
		t.Fatalf("the release PR job installs while it syncs bun.lock, got %+v", syncLock.With)
	}
}

func TestParsedLoaderArtifactsExpireOnlyOnPullRequests(t *testing.T) {
	intermediates := map[string]bool{"discord-source-ipa": true, "source ipa": true}
	uploaded := map[string]string{}
	for _, name := range []string{"loader-android.yml", "loader-build.yml", "loader-ios.yml"} {
		for jobName, job := range loadWorkflow(t, name).Jobs {
			for _, step := range job.Steps {
				if !strings.HasPrefix(step.Uses, "actions/upload-artifact@") {
					continue
				}
				artifact, retention := step.With["name"], step.With["retention-days"]
				uploaded[artifact] = retention
				if intermediates[artifact] {
					if retention != "1" {
						t.Errorf("%s %s keeps the decrypted %s for %q days, only its own run needs it", name, jobName, artifact, retention)
					}
					continue
				}
				if retention != pullRequestRetention {
					t.Errorf("%s %s must keep %s for 14 days on pull requests and the default otherwise, got %q", name, jobName, artifact, retention)
				}
			}
		}
	}
	build := loadWorkflow(t, "loader-build.yml")
	for _, jobName := range []string{"release", "android-prerelease"} {
		for _, step := range build.job(t, jobName).Steps {
			if !strings.HasPrefix(step.Uses, "actions/download-artifact@") {
				continue
			}
			retention, ok := uploaded[step.With["name"]]
			if !ok {
				t.Fatalf("%s downloads %q, which no loader job uploads", jobName, step.With["name"])
			}
			if retention != pullRequestRetention {
				t.Fatalf("%s needs %q, which must keep the default retention outside pull requests, got %q", jobName, step.With["name"], retention)
			}
		}
	}
}

func TestParsedReleasesAttachNativeSymbols(t *testing.T) {
	build := loadWorkflow(t, "loader-build.yml")
	release := build.job(t, "release")
	for step, artifact := range map[string]string{"Download iOS tweak symbols": "tweak symbols", "Download Android native symbols": "android symbols"} {
		if download := release.step(t, step); download.With["name"] != artifact || !strings.HasSuffix(download.With["path"], "-symbols") {
			t.Fatalf("the release must download %s into its own directory, got %+v", artifact, download.With)
		}
	}
	if !strings.Contains(release.step(t, "Package native symbols").Run, `zip -qr "../unbound-$platform-symbols.zip" .`) {
		t.Fatal("the release must zip each platform's symbols")
	}
	for step, archives := range map[string][]string{
		"Publish stable release":        {"unbound-ios-symbols.zip", "unbound-android-symbols.zip"},
		"Publish TestFlight prerelease": {"unbound-ios-symbols.zip"},
	} {
		files := release.step(t, step).With["files"]
		for _, archive := range archives {
			if !strings.Contains(files, "release-assets/"+archive) {
				t.Fatalf("%s must attach %s, attaches %q", step, archive, files)
			}
		}
	}
	if strings.Contains(release.step(t, "Publish TestFlight prerelease").With["files"], "android-symbols") {
		t.Fatal("a TestFlight prerelease has no Android build to attach symbols for")
	}
	prerelease := build.job(t, "android-prerelease")
	if prerelease.step(t, "Download Android native symbols").With["name"] != "android symbols" || !strings.Contains(prerelease.step(t, "Publish Android prerelease").With["files"], "release-assets/unbound-android-symbols.zip") {
		t.Fatal("Android prereleases must attach their native symbols")
	}
	module := loadWorkflow(t, "loader-android.yml").job(t, "build-module")
	if upload := module.step(t, "Upload native symbols"); upload.With["name"] != "android symbols" || upload.With["if-no-files-found"] != "error" {
		t.Fatalf("the module build must upload its native symbols, got %+v", upload.With)
	}
}
