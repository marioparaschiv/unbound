package main

import (
	"encoding/json"
	"net/url"
	"os"
	"path/filepath"
	"reflect"
	"regexp"
	"runtime"
	"strings"
	"testing"
)

func TestBuildWorkflowInstallsAutotoolsBeforeTweakBuild(t *testing.T) {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not locate test source")
	}
	root := filepath.Dir(filepath.Dir(filename))
	workflow, err := os.ReadFile(filepath.Join(root, "..", "..", ".github", "workflows", "loader-ios.yml"))
	if err != nil {
		t.Fatal(err)
	}
	buildTweakStart := strings.Index(string(workflow), "  build-tweak:\n")
	resolveSourceStart := strings.Index(string(workflow), "  resolve-source-ipa:\n")
	if buildTweakStart < 0 || resolveSourceStart <= buildTweakStart {
		t.Fatal("build-tweak job could not be located")
	}
	buildTweak := string(workflow[buildTweakStart:resolveSourceStart])
	installAutotools := strings.Index(buildTweak, "- name: Install Autotools")
	verifyAutotools := strings.Index(buildTweak, "- name: Verify Autotools")
	buildPackage := strings.Index(buildTweak, "- name: Build package")
	if installAutotools < 0 || verifyAutotools <= installAutotools || buildPackage <= verifyAutotools {
		t.Fatal("the tweak build must install and verify Autotools before building the package")
	}
	installStep := buildTweak[installAutotools:verifyAutotools]
	for _, prerequisite := range []string{
		"brew install autoconf automake libtool",
		"brew --prefix autoconf",
		"brew --prefix automake",
		"brew --prefix libtool",
	} {
		if !strings.Contains(installStep, prerequisite) {
			t.Fatalf("Autotools installation is missing %q", prerequisite)
		}
	}
	verifyStep := buildTweak[verifyAutotools:buildPackage]
	for _, tool := range []string{"autoreconf", "automake", "aclocal", "glibtoolize"} {
		if !strings.Contains(verifyStep, "command -v "+tool) {
			t.Fatalf("Autotools verification is missing %q", tool)
		}
	}
}

func TestBuildWorkflowArchivesMatchingTweakSymbols(t *testing.T) {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not locate test source")
	}
	root := filepath.Dir(filepath.Dir(filename))
	workflow, err := os.ReadFile(filepath.Join(root, "..", "..", ".github", "workflows", "loader-ios.yml"))
	if err != nil {
		t.Fatal(err)
	}
	contents := string(workflow)
	for _, required := range []string{
		"for architecture in arm64 arm64e; do",
		"test -f \"$binary\"",
		"test -d \"$bundle\"",
		"dwarfdump --uuid \"$binary\"",
		"dwarfdump --uuid \"$bundle\"",
		"test \"$binary_uuid\" = \"$symbols_uuid\"",
		"git rev-parse HEAD > symbols/commit.txt",
		"name: tweak symbols",
		"path: packages/loader/symbols/",
	} {
		if !strings.Contains(contents, required) {
			t.Fatalf("build workflow is missing symbol metadata %q", required)
		}
	}
}

func TestBuildWorkflowAllowsManualIPAInput(t *testing.T) {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not locate test source")
	}
	root := filepath.Dir(filepath.Dir(filename))
	workflow, err := os.ReadFile(filepath.Join(root, "..", "..", ".github", "workflows", "loader-build.yml"))
	if err != nil {
		t.Fatal(err)
	}
	contents := string(workflow)
	dispatchStart := strings.Index(contents, "  workflow_dispatch:\n")
	workflowCallStart := strings.Index(contents, "  workflow_call:\n")
	if dispatchStart < 0 || workflowCallStart <= dispatchStart {
		t.Fatal("workflow_dispatch input section could not be located")
	}
	dispatchInputs := contents[dispatchStart:workflowCallStart]
	if !strings.Contains(dispatchInputs, "      ipa_url:\n") {
		t.Fatal("manual builds must accept an IPA URL to avoid triggering a device decrypt")
	}
	if strings.Contains(contents, "--extensions") {
		t.Fatal("build workflow must not choose whether to include extensions")
	}
}

func TestBuildWorkflowSkipsDocumentationOnlyPushes(t *testing.T) {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not locate test source")
	}
	root := filepath.Dir(filepath.Dir(filename))
	workflow, err := os.ReadFile(filepath.Join(root, "..", "..", ".github", "workflows", "loader-build.yml"))
	if err != nil {
		t.Fatal(err)
	}
	contents := string(workflow)
	pushStart := strings.Index(contents, "  push:\n")
	dispatchStart := strings.Index(contents, "  workflow_dispatch:\n")
	if pushStart < 0 || dispatchStart <= pushStart {
		t.Fatal("push trigger could not be located")
	}
	pushTrigger := contents[pushStart:dispatchStart]
	for _, filter := range []string{"paths:", "'packages/loader/**'", "'.github/workflows/loader-*.yml'", "'!**/*.md'", "'!**/*.mdx'"} {
		if !strings.Contains(pushTrigger, filter) {
			t.Fatalf("build workflow push trigger is missing path filter %q", filter)
		}
	}
}

func TestBuildWorkflowCoordinatesBothPlatforms(t *testing.T) {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not locate test source")
	}
	root := filepath.Dir(filepath.Dir(filename))
	workflow, err := os.ReadFile(filepath.Join(root, "..", "..", ".github", "workflows", "loader-build.yml"))
	if err != nil {
		t.Fatal(err)
	}
	contents := string(workflow)
	for _, required := range []string{
		"uses: ./.github/workflows/loader-android.yml",
		"uses: ./.github/workflows/loader-ios.yml",
		"needs: resolve-source",
		"needs: [resolve-source, ios, android]",
		"ios_version: ${{ needs.resolve-source.outputs.version }}",
		"require_matching_version: ${{ inputs.release == true && inputs.is_testflight != true }}",
		"version: ${{ needs.resolve-source.outputs.version || inputs.version }}",
		"android_code=$(curl -fsSL \"$INPUT_ANDROID_TRACKER/index\" | jq -er '.latest.stable | tonumber')",
		"go run ./tools discord-version --android-code \"$android_code\"",
		"The iOS IPA is $version but the requested matching release is $requested_version",
		"secrets: inherit",
		"value: ${{ jobs.android.outputs.module_filename }}",
		"value: ${{ jobs.android.outputs.patched_filename }}",
		"name: ios-simulator",
		"name: Publish stable release",
		"name: Publish TestFlight prerelease",
		"if: inputs.is_testflight != true",
	} {
		if !strings.Contains(contents, required) {
			t.Fatalf("build workflow is missing platform orchestration detail %q", required)
		}
	}
	iosWorkflow, err := os.ReadFile(filepath.Join(root, "..", "..", ".github", "workflows", "loader-ios.yml"))
	if err != nil {
		t.Fatal(err)
	}
	for _, required := range []string{
		"INPUT_RELEASE: ${{ inputs.release }}",
		"The source IPA is $source_version but the selected combined release is $INPUT_VERSION",
	} {
		if !strings.Contains(string(iosWorkflow), required) {
			t.Fatalf("iOS workflow is missing exact-version validation %q", required)
		}
	}
	androidStart := strings.Index(contents, "  android:\n")
	iosStart := strings.Index(contents, "  ios:\n")
	if androidStart < 0 || iosStart < 0 {
		t.Fatal("platform workflow calls could not be located")
	}
	androidJob := contents[androidStart:iosStart]
	if strings.Contains(androidJob, "needs: [resolve-source, ios]") || strings.Contains(androidJob, "needs: ios") {
		t.Fatal("Android and iOS builds must run in parallel after source resolution")
	}
	android, err := os.ReadFile(filepath.Join(root, "..", "..", ".github", "workflows", "loader-android.yml"))
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(android), "    push:") {
		t.Fatal("Android should be built through the cross-platform coordinator on push")
	}
	for _, required := range []string{
		"name=\"app.unbound.android.lsposed.apk\"",
		`if [[ "$IOS_VERSION" =~ ^([0-9]+)\.([0-9]+)(\.|_|$) ]]; then`,
		"candidate=\"${BASH_REMATCH[1]}$(printf '%03d' \"${BASH_REMATCH[2]}\")\"",
		"version=\"${version:-$latest_version}\"",
		"REQUIRE_MATCHING_VERSION: ${{ inputs.require_matching_version }}",
		`apk_version_code=$("$build_tools/aapt" dump badging discord/base.apk`,
		`"$apk_version_code" != "$version"`,
		"name=\"Unbound.apks\"",
	} {
		if !strings.Contains(string(android), required) {
			t.Fatalf("Android workflow is missing matching version or artifact detail %q", required)
		}
	}
	pollWorkflow, err := os.ReadFile(filepath.Join(root, "..", "..", ".github", "workflows", "loader-release-poll.yml"))
	if err != nil {
		t.Fatal(err)
	}
	for _, required := range []string{
		"schedule:",
		"cron: '17 */3 * * *'",
		"go run ./tools release-candidate --channel stable",
		"go run ./tools release-candidate --channel testflight",
		"uses: ./.github/workflows/loader-build.yml",
		"is_testflight: true",
		"needs: [testflight-candidate, stable-release]",
		"if: always() && needs.testflight-candidate.outputs.version != ''",
	} {
		if !strings.Contains(string(pollWorkflow), required) {
			t.Fatalf("scheduled release polling is missing %q", required)
		}
	}
	if _, err := os.Stat(filepath.Join(root, "..", "..", ".github", "workflows", "loader-remote-deploy.yml")); !os.IsNotExist(err) {
		t.Fatal("the dkrypt repository-dispatch workflow must be removed")
	}
}

func TestObtainiumConfigTracksTheRootedAndroidModule(t *testing.T) {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not locate test source")
	}
	root := filepath.Dir(filepath.Dir(filename))
	configBytes, err := os.ReadFile(filepath.Join(root, "obtainium.json"))
	if err != nil {
		t.Fatal(err)
	}
	var config struct {
		ID                 string `json:"id"`
		URL                string `json:"url"`
		AdditionalSettings string `json:"additionalSettings"`
	}
	if err := json.Unmarshal(configBytes, &config); err != nil {
		t.Fatal(err)
	}
	if config.ID != "app.unbound.android" || config.URL != "https://github.com/marioparaschiv/unbound" {
		t.Fatalf("Obtainium config targets an unexpected app: %#v", config)
	}
	var settings struct {
		APKFilterRegEx             string `json:"apkFilterRegEx"`
		FilterReleaseTitlesByRegEx string `json:"filterReleaseTitlesByRegEx"`
	}
	if err := json.Unmarshal([]byte(config.AdditionalSettings), &settings); err != nil {
		t.Fatal(err)
	}
	for title, wanted := range map[string]bool{"loader-v350.8": true, "v0.9.0": false} {
		if matched, err := regexp.MatchString(settings.FilterReleaseTitlesByRegEx, title); err != nil || matched != wanted {
			t.Fatalf("Obtainium release filter %q on %q matched %v, want %v", settings.FilterReleaseTitlesByRegEx, title, matched, wanted)
		}
	}
	matches, err := regexp.MatchString(settings.APKFilterRegEx, "app.unbound.android.lsposed.apk")
	if err != nil {
		t.Fatal(err)
	}
	if !matches {
		t.Fatalf("Obtainium APK filter does not select the release module: %q", settings.APKFilterRegEx)
	}
	androidWorkflow, err := os.ReadFile(filepath.Join(root, "..", "..", ".github", "workflows", "loader-android.yml"))
	if err != nil {
		t.Fatal(err)
	}
	for _, required := range []string{
		"name=\"app.unbound.android.lsposed.apk\"",
		"ANDROID_SIGNING_KEYSTORE_BASE64",
		"ANDROID_SIGNING_STORE_PASSWORD",
		"ANDROID_SIGNING_KEY_ALIAS",
		"ANDROID_SIGNING_KEY_PASSWORD",
		"Android release signing secrets are required for Obtainium-compatible updates",
	} {
		if !strings.Contains(string(androidWorkflow), required) {
			t.Fatalf("Android release workflow is missing Obtainium update support %q", required)
		}
	}
}

func TestPullRequestWorkflowUsesPinnedCleanDiscordIPA(t *testing.T) {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not locate test source")
	}
	root := filepath.Dir(filepath.Dir(filename))
	workflow, err := os.ReadFile(filepath.Join(root, "..", "..", ".github", "workflows", "loader-ci.yml"))
	if err != nil {
		t.Fatal(err)
	}
	contents := string(workflow)
	for _, required := range []string{
		"https://raw.githubusercontent.com/Tulugaak/Discord-205.0-IPA/4eec98e61e20d0720c091d42c4a762710b32e8c5/com.hammerandchisel.discord_861573261.ipa",
		"release: false",
	} {
		if !strings.Contains(contents, required) {
			t.Fatalf("pull request workflow is missing %q", required)
		}
	}
	for _, retired := range []string{"ipa.aspy.dev", "files.catbox.moe/pk80qh.ipa"} {
		if strings.Contains(contents, retired) {
			t.Fatalf("pull request workflow still references retired IPA source %q", retired)
		}
	}
}

func TestPullRequestWorkflowChecksPinnedSupportedDiscordFixtures(t *testing.T) {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not locate test source")
	}
	root := filepath.Dir(filepath.Dir(filename))
	workflow, err := os.ReadFile(filepath.Join(root, "..", "..", ".github", "workflows", "loader-ci.yml"))
	if err != nil {
		t.Fatal(err)
	}
	contents := string(workflow)
	for _, required := range []string{
		"version: ['347.0', '341.0']",
		"name: rootless package",
		"--bundle-id com.hammerandchisel.discord",
		"--version \"$DISCORD_VERSION\"",
		"needs.compatibility-source.outputs.available == 'true'",
		"link/package checks, not Discord device-runtime validation",
	} {
		if !strings.Contains(contents, required) {
			t.Fatalf("pull request workflow is missing compatibility check %q", required)
		}
	}
	if strings.Contains(contents, "--extensions") {
		t.Fatal("pull request workflow must not choose whether to include extensions")
	}
}

func TestDependabotAutomergeWaitsForSuccessfulBuild(t *testing.T) {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not locate test source")
	}
	root := filepath.Dir(filepath.Dir(filename))
	workflow, err := os.ReadFile(filepath.Join(root, "..", "..", ".github", "workflows", "loader-dependabot-automerge.yml"))
	if err != nil {
		t.Fatal(err)
	}
	contents := string(workflow)
	for _, required := range []string{
		"name: Loader Auto-merge Dependabot",
		"- Loader Pull Request Build",
		"if: github.event.workflow_run.conclusion == 'success'",
		"pull-requests: write",
		"contents: write",
		"dependabot[bot]",
		".head.sha",
		".head_sha",
		"gh pr merge \"$PR_NUMBER\" --auto --squash",
	} {
		if !strings.Contains(contents, required) {
			t.Fatalf("Dependabot auto-merge workflow is missing %q", required)
		}
	}
	if strings.Contains(contents, "actions/checkout") {
		t.Fatal("Dependabot auto-merge workflow must not check out pull request code")
	}
}

func TestStableReleasePublishesLoaderUpdateRecords(t *testing.T) {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not locate test source")
	}
	root := filepath.Dir(filepath.Dir(filename))
	workflow, err := os.ReadFile(filepath.Join(root, "..", "..", ".github", "workflows", "loader-build.yml"))
	if err != nil {
		t.Fatal(err)
	}
	contents := string(workflow)
	for _, required := range []string{
		"name: Publish loader update records",
		"UNBOUND_API_KEY: ${{ secrets.UNBOUND_API_KEY }}",
		"UNBOUND_API_URL: ${{ vars.UNBOUND_API_URL }}",
		"UNBOUND_API_KEY is required for stable release publication",
		"UNBOUND_API_URL is required for stable release publication",
		"api_url=\"${UNBOUND_API_URL%/}/api/v1/loader/releases\"",
		"--api-url \"$api_url\"",
		"dpkg-deb -f \"$deb_path\" Version",
		"fetch-depth: 0",
		"go run ./tools generate-loader-changelog",
		"--output release-assets/loader-changelog.md",
		"--changelog-file release-assets/loader-changelog.md",
		"go run ./tools publish-loader-releases",
		"loader-release",
		"loader-release",
		"--ios-url \"$release_url/$IOS_DEB_FILENAME\"",
		"--android-url \"$release_url/$ANDROID_MODULE_FILENAME\"",
		"needs.resolve-source.outputs.is_testflight != 'true'",
	} {
		if !strings.Contains(contents, required) {
			t.Fatalf("stable release workflow is missing loader update publishing detail %q", required)
		}
	}
	for _, forbidden := range []string{
		"loader_version=$(go run ./tools loader-version",
		"IOS_BUILD:",
		"LOADER_VERSION:",
		"resolve.outputs.loader_version",
		"targets Discord",
		"generated-release-notes.md",
		"publish-loader-release --platform",
	} {
		if strings.Contains(contents, forbidden) {
			t.Fatalf("loader release version or changelog must not be tied to the Discord build: %q", forbidden)
		}
	}
	for _, workflowName := range []string{"ios.yml", "android.yml"} {
		workflow, err := os.ReadFile(filepath.Join(root, "..", "..", ".github", "workflows", "loader-"+workflowName))
		if err != nil {
			t.Fatal(err)
		}
		if strings.Contains(string(workflow), "loader_version") || strings.Contains(string(workflow), "LOADER_PACKAGE_VERSION") {
			t.Fatalf("%s must read the loader package semver instead of a Discord-derived override", workflowName)
		}
	}
	publisher, err := os.ReadFile(filepath.Join(root, "tools", "loader_release.go"))
	if err != nil {
		t.Fatal(err)
	}
	for _, required := range []string{
		"/updates",
		"query.Set(\"platform\", platform)",
		"query.Set(\"version\", \"0.0.0\")",
		"comparison == 0",
		"comparison < 0",
	} {
		if !strings.Contains(string(publisher), required) {
			t.Fatalf("loader release semver gate is missing %q", required)
		}
	}
	releaseConfig, err := os.ReadFile(filepath.Join(root, "..", "..", ".github", "release.yml"))
	if err != nil {
		t.Fatal(err)
	}
	for _, required := range []string{
		"title: Features",
		"title: Fixes",
		"title: Performance",
		"title: Maintenance",
		"title: Dependencies",
		"title: Other changes",
	} {
		if !strings.Contains(string(releaseConfig), required) {
			t.Fatalf("semantic release categories are missing %q", required)
		}
	}
}

func TestMetroRegistryIsCapturedBeforeBundleWithoutLegacyPatch(t *testing.T) {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not locate test source")
	}
	root := filepath.Dir(filepath.Dir(filename))
	if _, err := os.Stat(filepath.Join(root, "bootstrap", "modules.js")); !os.IsNotExist(err) {
		t.Fatal("legacy modules bootstrap shim must not be packaged")
	}
	for _, path := range []string{
		filepath.Join(root, "core", "src", "LoaderPipeline.cpp"),
		filepath.Join(root, "ios", "sources", "Unbound.xm"),
		filepath.Join(root, "android", "module", "src", "main", "cpp", "AndroidLoader.cpp"),
	} {
		contents, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		if strings.Contains(string(contents), "injectModulesPatch") || strings.Contains(string(contents), "modulesScript") {
			t.Fatalf("legacy modules bootstrap plumbing remains in %s", path)
		}
	}
	contents, err := os.ReadFile(filepath.Join(root, "core", "src", "LoaderPipeline.cpp"))
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(contents), "globalThis.__c?.()") {
		t.Fatal("bundle readiness must not invoke Metro's destructive registry collector")
	}
	capture, err := os.ReadFile(filepath.Join(root, "core", "src", "LoaderJSI.cpp"))
	if err != nil {
		t.Fatal(err)
	}
	script, err := os.ReadFile(filepath.Join(root, "bootstrap", "metro-module-capture.js"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(capture), "bootstrap::kMetroModuleCapture") || !strings.Contains(string(script), "Object.defineProperty(globalThis, '__d'") {
		t.Fatal("shared loader no longer captures the Metro registry before module definitions")
	}
}

func TestLoaderReleasePublisherCannotBypassBatchSemverGate(t *testing.T) {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not locate test source")
	}
	root := filepath.Dir(filepath.Dir(filename))
	mainSource, err := os.ReadFile(filepath.Join(root, "tools", "main.go"))
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(mainSource), "case \"publish-loader-release\":") || strings.Contains(string(mainSource), "publish-loader-release --platform") {
		t.Fatal("loader release publishing must use the all-platform SemVer gate")
	}
}

func TestLoaderReleasesUseTheirOwnTagNamespace(t *testing.T) {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not locate test source")
	}
	root := filepath.Dir(filepath.Dir(filename))
	workflows := filepath.Join(root, "..", "..", ".github", "workflows")
	build, err := os.ReadFile(filepath.Join(workflows, "loader-build.yml"))
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(build), "tag_name: v") || !strings.Contains(string(build), "tag_name: loader-v") {
		t.Fatal("loader releases must be tagged loader-v<version> so they never collide with client tags")
	}
	ios, err := os.ReadFile(filepath.Join(workflows, "loader-ios.yml"))
	if err != nil {
		t.Fatal(err)
	}
	if regexp.MustCompile(`gh release download --repo`).Match(ios) {
		t.Fatal("loader release downloads must name a loader tag instead of taking the repository's latest release")
	}
	poll, err := os.ReadFile(filepath.Join(root, "tools", "release_poll.go"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(poll), `tag := "loader-v" + version`) {
		t.Fatal("the release poll must look for loader-v<version> releases")
	}
}

func TestPullRequestBuildGrantsWhatTheNestedBuildJobsDeclare(t *testing.T) {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not locate test source")
	}
	root := filepath.Dir(filepath.Dir(filename))
	workflow, err := os.ReadFile(filepath.Join(root, "..", "..", ".github", "workflows", "loader-ci.yml"))
	if err != nil {
		t.Fatal(err)
	}
	contents := string(workflow)
	start := strings.Index(contents, "    build:\n")
	end := strings.Index(contents, "uses: ./.github/workflows/loader-build.yml")
	if start < 0 || end <= start {
		t.Fatal("the pull request build job could not be located")
	}
	job := contents[start:end]
	for _, permission := range []string{"contents: write", "id-token: write", "attestations: write", "artifact-metadata: write"} {
		if !strings.Contains(job, permission) {
			t.Fatalf("the pull request build job must grant %q, which the nested build jobs declare", permission)
		}
	}
}

func TestLoaderWorkflowsCacheTheirSlowestInputs(t *testing.T) {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not locate test source")
	}
	workflows := filepath.Join(filepath.Dir(filepath.Dir(filename)), "..", "..", ".github", "workflows")
	read := func(name string) string {
		contents, err := os.ReadFile(filepath.Join(workflows, name))
		if err != nil {
			t.Fatal(err)
		}
		return string(contents)
	}
	for _, name := range []string{"loader-build.yml", "loader-ci.yml", "loader-ios.yml", "loader-release-poll.yml"} {
		contents := read(name)
		setups := strings.Count(contents, "uses: actions/setup-go@")
		caches := strings.Count(contents, "name: Cache Go builds")
		if caches == 0 || caches < setups-1 {
			t.Fatalf("%s sets up Go %d times but caches Go builds %d times", name, setups, caches)
		}
	}
	ios := read("loader-ios.yml")
	for _, required := range []string{
		"path: packages/loader/ios/.theos/libffi",
		"if: steps.libffi-cache.outputs.cache-hit != 'true'",
		"path: packages/loader/.tools-cache",
		"HOMEBREW_NO_AUTO_UPDATE: 1",
	} {
		if !strings.Contains(ios, required) {
			t.Fatalf("the iOS workflow is missing %q", required)
		}
	}
	if strings.Contains(ios, "merge-multiple: true") {
		t.Fatal("the IPA build must download only the artifacts it packages")
	}
	if android := read("loader-android.yml"); !strings.Contains(android, "uses: gradle/actions/setup-gradle@") || !strings.Contains(android, "--build-cache") {
		t.Fatal("the Android module build must use the Gradle cache")
	}
}

func TestCompatScanCoversEveryDiscordChannel(t *testing.T) {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not locate test source")
	}
	root := filepath.Dir(filepath.Dir(filename))
	workflow, err := os.ReadFile(filepath.Join(root, "..", "..", ".github", "workflows", "discord-compat.yml"))
	if err != nil {
		t.Fatal(err)
	}
	contents := string(workflow)
	for _, required := range []string{
		"cron: '23 */6 * * *'",
		"options: [stable, beta, alpha]",
		`'["stable","beta","alpha"]'`,
		"IOS_SOURCE: ${{ matrix.channel == 'stable' && 'appstore' || matrix.channel == 'beta' && 'testflight' || 'none' }}",
		"DISCORD_SNIFF_URL: https://sniff.xhyrom.dev",
		`go run ./tools discord-apk --channel "$CHANNEL" --output-dir discord-android --split base`,
		"if: env.IOS_SOURCE != 'none'",
		`if [ "$IOS_SOURCE" = appstore ]; then`,
		"fetch-ipa.py com.hammerandchisel.discord testflight",
		`if [ "$IOS_SOURCE" != none ]; then scan_args+=(--ipa discord.ipa); fi`,
		"name: compat-${{ matrix.channel }}",
		`--name "compat-$CHANNEL"`,
		`go run ./tools compat-issue --repo "$GITHUB_REPOSITORY" --channel "$CHANNEL"`,
	} {
		if !strings.Contains(contents, required) {
			t.Fatalf("compat workflow is missing %q", required)
		}
	}
	if strings.Contains(contents, "% 1000") {
		t.Fatal("the compat workflow must not derive Android version names from the code by hand")
	}
}

type obtainiumTestConfig struct {
	ID       string
	URL      string
	Name     string
	Settings struct {
		APKFilterRegEx             string `json:"apkFilterRegEx"`
		FilterReleaseTitlesByRegEx string `json:"filterReleaseTitlesByRegEx"`
		IncludePrereleases         bool   `json:"includePrereleases"`
		FallbackToOlderReleases    bool   `json:"fallbackToOlderReleases"`
		SortMethodChoice           string `json:"sortMethodChoice"`
	}
	raw []byte
}

func readObtainiumConfig(t *testing.T, name string) obtainiumTestConfig {
	t.Helper()
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not locate test source")
	}
	raw, err := os.ReadFile(filepath.Join(filepath.Dir(filepath.Dir(filename)), name))
	if err != nil {
		t.Fatal(err)
	}
	var file struct {
		ID                 string `json:"id"`
		URL                string `json:"url"`
		Name               string `json:"name"`
		AdditionalSettings string `json:"additionalSettings"`
	}
	if err := json.Unmarshal(raw, &file); err != nil {
		t.Fatal(err)
	}
	config := obtainiumTestConfig{ID: file.ID, URL: file.URL, Name: file.Name, raw: raw}
	if err := json.Unmarshal([]byte(file.AdditionalSettings), &config.Settings); err != nil {
		t.Fatal(err)
	}
	return config
}

func TestObtainiumConfigsTrackOneDiscordChannelEach(t *testing.T) {
	releases := map[string]string{
		"stable": "loader-v350.8",
		"beta":   "loader-v351.12-android-beta",
		"alpha":  "loader-v352.8-android-alpha",
	}
	others := []string{"loader-v351.0_118370", "loader-latest", "Unbound loader (latest)", "v0.9.0"}
	assets := map[string]string{"stable": "Unbound.apks", "beta": "Unbound-beta.apks", "alpha": "Unbound-alpha.apks"}
	for channel := range releases {
		config := readObtainiumConfig(t, "obtainium-"+channel+".json")
		if config.ID != "com.discord" || config.URL != "https://github.com/marioparaschiv/unbound" {
			t.Fatalf("the %s Obtainium config targets an unexpected app: %+v", channel, config)
		}
		if !config.Settings.FallbackToOlderReleases || config.Settings.SortMethodChoice != "date" {
			t.Fatalf("the %s Obtainium config must look past newer releases of other channels: %+v", channel, config.Settings)
		}
		if config.Settings.IncludePrereleases != (channel != "stable") {
			t.Fatalf("the %s Obtainium config includes prereleases=%t", channel, config.Settings.IncludePrereleases)
		}
		titles := regexp.MustCompile(config.Settings.FilterReleaseTitlesByRegEx)
		apks := regexp.MustCompile(config.Settings.APKFilterRegEx)
		for other, release := range releases {
			if titles.MatchString(release) != (other == channel) {
				t.Fatalf("the %s Obtainium release filter matched %q=%t", channel, release, other == channel)
			}
			if apks.MatchString(assets[other]) != (other == channel) {
				t.Fatalf("the %s Obtainium APK filter matched %q=%t", channel, assets[other], other == channel)
			}
		}
		for _, release := range others {
			if titles.MatchString(release) {
				t.Fatalf("the %s Obtainium release filter matched %q", channel, release)
			}
		}
		if apks.MatchString("app.unbound.android.lsposed.apk") {
			t.Fatalf("the %s Obtainium config would install the LSPosed module", channel)
		}
	}
	module := readObtainiumConfig(t, "obtainium.json")
	if !module.Settings.FallbackToOlderReleases || module.Settings.IncludePrereleases {
		t.Fatalf("the module config must skip the rolling and prerelease releases: %+v", module.Settings)
	}
}

func TestObtainiumLinksMatchTheirConfigs(t *testing.T) {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not locate test source")
	}
	root := filepath.Dir(filepath.Dir(filename))
	link := regexp.MustCompile(`obtainium://app/([^)\s"']+)`)
	for _, document := range []string{filepath.Join(root, "README.md"), filepath.Join(root, "..", "..", "docs", "user-guide", "installing.mdx")} {
		contents, err := os.ReadFile(document)
		if err != nil {
			t.Fatal(err)
		}
		found := map[string]bool{}
		for _, match := range link.FindAllStringSubmatch(string(contents), -1) {
			decoded, err := url.PathUnescape(match[1])
			if err != nil {
				t.Fatalf("%s has an undecodable Obtainium link: %v", document, err)
			}
			var linked map[string]any
			if err := json.Unmarshal([]byte(decoded), &linked); err != nil {
				t.Fatalf("%s links Obtainium to invalid JSON %q", document, decoded)
			}
			matched := ""
			for _, name := range []string{"obtainium.json", "obtainium-stable.json", "obtainium-beta.json", "obtainium-alpha.json"} {
				var config map[string]any
				if err := json.Unmarshal(readObtainiumConfig(t, name).raw, &config); err != nil {
					t.Fatal(err)
				}
				if reflect.DeepEqual(config, linked) {
					matched = name
				}
			}
			if matched == "" {
				t.Fatalf("%s has an Obtainium link that matches no config: %s", document, decoded)
			}
			found[matched] = true
		}
		if len(found) != 4 {
			t.Fatalf("%s links %d of the 4 Obtainium configs", document, len(found))
		}
	}
}

func TestAndroidChannelsReleaseLikeTestflight(t *testing.T) {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not locate test source")
	}
	workflows := filepath.Join(filepath.Dir(filepath.Dir(filename)), "..", "..", ".github", "workflows")
	read := func(name string) string {
		contents, err := os.ReadFile(filepath.Join(workflows, name))
		if err != nil {
			t.Fatal(err)
		}
		return string(contents)
	}
	poll := read("loader-release-poll.yml")
	for _, required := range []string{
		"go run ./tools release-candidate --channel android-beta",
		"go run ./tools release-candidate --channel android-alpha",
		"android_code: ${{ steps.candidate.outputs.android_code }}",
		"needs: [android-beta-candidate, testflight-release]",
		"needs: [android-alpha-candidate, android-beta-release]",
		"if: always() && needs.android-beta-candidate.outputs.version != ''",
		"if: always() && needs.android-alpha-candidate.outputs.version != ''",
		"android_channel: beta",
		"android_channel: alpha",
		"android_code: ${{ needs.android-beta-candidate.outputs.android_code }}",
		"android_code: ${{ needs.android-alpha-candidate.outputs.android_code }}",
	} {
		if !strings.Contains(poll, required) {
			t.Fatalf("scheduled release polling is missing %q", required)
		}
	}
	build := read("loader-build.yml")
	for _, required := range []string{
		"      android_channel:\n",
		"      android_code:\n",
		"beta|alpha) ;;",
		`release=$(go run ./tools discord-apk "${apk_args[@]}")`,
		"android_code: ${{ steps.resolve.outputs.code }}",
		"discord_channel: ${{ inputs.android_channel || 'stable' }}",
		"android_code: ${{ needs.resolve-source.outputs.android_code }}",
		"if: always() && inputs.android_channel == '' && (inputs.only_app_repo == true",
		"if: always() && inputs.release == true && inputs.android_channel == '' && inputs.only_app_repo != true",
		"if: always() && inputs.release == true && inputs.android_channel != '' && needs.resolve-source.result == 'success' && needs.android.result == 'success'",
		"name: Publish Android prerelease",
	} {
		if !strings.Contains(build, required) {
			t.Fatalf("the build coordinator is missing Android channel detail %q", required)
		}
	}
	prereleaseStart := strings.Index(build, "  android-prerelease:\n")
	appRepoStart := strings.Index(build, "  publish-app-repo:\n")
	if prereleaseStart < 0 || appRepoStart <= prereleaseStart {
		t.Fatal("the Android prerelease job could not be located")
	}
	prerelease := build[prereleaseStart:appRepoStart]
	for _, required := range []string{"tag_name: loader-v${{ needs.resolve-source.outputs.release_version }}", "prerelease: true", "make_latest: false", "needs.android.outputs.patched_filename", "needs.android.outputs.module_filename"} {
		if !strings.Contains(prerelease, required) {
			t.Fatalf("the Android prerelease is missing %q", required)
		}
	}
	for _, forbidden := range []string{"loader-latest", "publish-loader-releases", "needs.ios.outputs"} {
		if strings.Contains(prerelease, forbidden) {
			t.Fatalf("an Android prerelease must not touch %q", forbidden)
		}
	}
	android := read("loader-android.yml")
	for _, required := range []string{
		"options: [stable, beta, alpha]",
		"DISCORD_CHANNEL: ${{ inputs.discord_channel || 'stable' }}",
		"ANDROID_CODE: ${{ inputs.android_code }}",
		`env -u GITHUB_OUTPUT go run ./tools discord-apk --channel "$DISCORD_CHANNEL" --code "$version" --output-dir discord "${split_args[@]}"`,
		`if [ "$DISCORD_CHANNEL" != stable ]; then name="Unbound-$DISCORD_CHANNEL.apks"; fi`,
	} {
		if !strings.Contains(android, required) {
			t.Fatalf("the Android workflow is missing channel detail %q", required)
		}
	}
}
