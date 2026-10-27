package main

import (
	"strings"
	"testing"
)

func legacyReference(references []*compatReference, name string, legacy bool) *compatReference {
	for _, reference := range references {
		if reference.Kind == referenceJavaClass && reference.Name == name && reference.Legacy == legacy {
			return reference
		}
	}
	return nil
}

func TestKotlinLegacyExtraction(t *testing.T) {
	source := `package app.unbound.android

object Themes {
    private val THEME_MANAGER = HostClass.legacy("com.discord.theme.ThemeManager")
    private val THEME_TYPE = HostClass.legacy(
        "com.discord.theme.DiscordTheme"
    )
    private const val THEME_OBJECT = "com.discord.theme.DiscordThemeObject"
}
`
	set := newCompatSourceSet()
	file := compatSourceFile{path: "packages/loader/android/module/src/main/kotlin/app/unbound/android/Themes.kt", component: "loader-android", platform: "android"}
	extractNativeReferences(set, file, source)
	references := set.sorted()

	manager := legacyReference(references, "com.discord.theme.ThemeManager", true)
	if manager == nil || manager.Locations[0].Line != 4 {
		t.Fatalf("a HostClass.legacy name must be marked legacy at its line: %+v", references)
	}
	if theme := legacyReference(references, "com.discord.theme.DiscordTheme", true); theme == nil || theme.Locations[0].Line != 6 {
		t.Fatalf("a multi-line HostClass.legacy name must be marked legacy at its own line: %+v", references)
	}
	if legacyReference(references, "com.discord.theme.ThemeManager", false) != nil {
		t.Fatal("a legacy name must not also be checked on its own")
	}
	if legacyReference(references, "com.discord.theme.DiscordThemeObject", false) == nil {
		t.Fatal("names outside HostClass.legacy must still be checked on their own")
	}
}

func TestScriptLegacyExtraction(t *testing.T) {
	source := `import { legacyJavaClass } from '@unbound-plugins/shared/native/android/legacy-classes';
const REACTION_VIEW = legacyJavaClass('com.discord.reactions.ReactionView');
const ROW = 'com.discord.reactions.ShortcutsFlexbox';
`
	references := scriptReferences(t, "packages/plugins/demo/src/android/index.ts", source)

	if legacyReference(references, "com.discord.reactions.ReactionView", true) == nil {
		t.Fatalf("a legacyJavaClass name must be marked legacy: %+v", references)
	}
	if legacyReference(references, "com.discord.reactions.ShortcutsFlexbox", false) == nil {
		t.Fatalf("a plain name must stay unmarked: %+v", references)
	}
}

func TestEvaluateCompatLegacy(t *testing.T) {
	location := []compatLocation{{File: "Themes.kt", Line: 1}}
	references := []*compatReference{
		{Kind: referenceJavaClass, Name: "com.discord.legacy.ThemeManager", Legacy: true, Component: "loader-android", Locations: location},
		{Kind: referenceJavaClass, Name: "com.discord.legacy.ThemeManager", Component: "loader-android", Locations: location},
		{Kind: referenceJavaClass, Name: "com.discord.legacy.ThemeManager", Component: "plugin:demo", Locations: location},
		{Kind: referenceJavaClass, Name: "com.discord.View", Legacy: true, Component: "plugin:demo", Locations: location},
	}
	results := evaluateCompat(references, []*compatTarget{compatTestTargets()[1]}, nil)

	expect := func(index int, status, reason string) {
		t.Helper()
		for _, finding := range results.Findings {
			if finding.Reference == references[index] {
				if finding.Status != status || !strings.Contains(finding.Reason, reason) {
					t.Fatalf("reference %d: got %q (%s), want %q containing %q", index, finding.Status, finding.Reason, status, reason)
				}
				return
			}
		}
		if status != "" {
			t.Fatalf("reference %d has no finding, want %q", index, status)
		}
	}
	covered := "only older Discord builds have it"
	expect(0, compatFallback, covered)
	expect(1, compatFallback, covered)
	expect(2, compatBroken, "not in Discord's dex")
	expect(3, compatOK, "")

	if !compatHasProblems(results) {
		t.Fatal("a legacy mark must only cover the component that declares it")
	}
	if compatHasProblems(evaluateCompat(references[:2], []*compatTarget{compatTestTargets()[1]}, nil)) {
		t.Fatal("names a component marks as legacy must not be problems")
	}
}

func TestKotlinLegacyMethodExtraction(t *testing.T) {
	source := `package app.unbound.android

object Unbound {
    fun loaders(reactInstance: Class<*>, bundleLoader: Class<*>) =
        reactInstance.legacyMethod("loadJSBundle", bundleLoader) ?: reactInstance.getDeclaredMethod("loadJSBundleFromFile", String::class.java)
}
`
	set := newCompatSourceSet()
	file := compatSourceFile{path: "packages/loader/android/module/src/main/kotlin/app/unbound/android/Unbound.kt", component: "loader-android", platform: "android"}
	extractNativeReferences(set, file, source)
	var legacy, current *compatReference
	for _, reference := range set.sorted() {
		if reference.Kind != referenceJavaMethod {
			continue
		}
		switch reference.Name {
		case "loadJSBundle":
			legacy = reference
		case "loadJSBundleFromFile":
			current = reference
		}
	}
	if legacy == nil || !legacy.Legacy || legacy.Locations[0].Line != 5 {
		t.Fatalf("a legacyMethod name must be a legacy method reference at its line: %+v", legacy)
	}
	if current == nil || current.Legacy {
		t.Fatalf("a plain getDeclaredMethod name must stay unmarked: %+v", current)
	}
}

func TestEvaluateCompatLegacyMethodSeenBefore(t *testing.T) {
	location := []compatLocation{{File: "Unbound.kt", Line: 5}}
	reference := &compatReference{Kind: referenceJavaMethod, Name: "loadJSBundle", Legacy: true, Component: "loader-android", Locations: location}
	target := compatTestTargets()[1]
	baseline := &compatResults{Platforms: map[string]*compatPlatformState{"android": {Seen: []string{reference.key()}, Statuses: map[string]string{}}}}
	results := evaluateCompat([]*compatReference{reference}, []*compatTarget{target}, baseline)
	for _, finding := range results.Findings {
		if finding.Reference == reference && finding.Status != compatFallback {
			t.Fatalf("a legacy method an earlier build had must be covered, got %q (%s)", finding.Status, finding.Reason)
		}
	}
	if compatHasProblems(results) {
		t.Fatalf("a legacy method must not be a problem: %+v", results.Findings)
	}
}

func TestEvaluateCompatLegacyMethodWithoutBaseline(t *testing.T) {
	location := []compatLocation{{File: "Unbound.kt", Line: 5}}
	reference := &compatReference{Kind: referenceJavaMethod, Name: "loadJSBundle", Legacy: true, Component: "loader-android", Locations: location}
	results := evaluateCompat([]*compatReference{reference}, []*compatTarget{compatTestTargets()[1]}, nil)
	for _, finding := range results.Findings {
		if finding.Reference == reference && finding.Status != compatFallback {
			t.Fatalf("a missing legacy method must be covered even without a baseline, got %q (%s)", finding.Status, finding.Reason)
		}
	}
}
