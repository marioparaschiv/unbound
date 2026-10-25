package main

import (
	"strings"
	"testing"
)

func groupedReference(references []*compatReference, kind, name string, grouped bool) *compatReference {
	for _, reference := range references {
		if reference.Kind == kind && (reference.Name == name || strings.Join(reference.Terms, ",") == name) && (reference.Group != "") == grouped {
			return reference
		}
	}
	return nil
}

func TestKotlinFallbackExtraction(t *testing.T) {
	source := `package app.unbound.android

object Themes {
    private val THEME_MANAGER = HostClass(
        "com.discord.theme.next.ThemeManager",
        "com.discord.theme.ThemeManager",
    )
    private val SURFACE = HostClass("com.facebook.react.runtime.ReactSurfaceImpl", "com.facebook.react.ReactSurface")
    private val ONLY = HostClass("com.discord.theme.DiscordTheme")
    private const val LEGACY = "com.discord.theme.ThemeManager"
}
`
	set := newCompatSourceSet()
	file := compatSourceFile{path: "packages/loader/android/module/src/main/kotlin/app/unbound/android/Themes.kt", component: "loader-android", platform: "android"}
	extractNativeReferences(set, file, source)
	references := set.sorted()

	current := groupedReference(references, referenceJavaClass, "com.discord.theme.next.ThemeManager", true)
	legacy := groupedReference(references, referenceJavaClass, "com.discord.theme.ThemeManager", true)
	if current == nil || legacy == nil {
		t.Fatalf("multi-line HostClass names were not grouped: %+v", references)
	}
	if current.Group != file.path+":4" || legacy.Group != current.Group || current.Alternative != 0 || legacy.Alternative != 1 {
		t.Fatalf("HostClass alternatives are wrong: %+v %+v", current, legacy)
	}
	if current.Locations[0].Line != 5 || legacy.Locations[0].Line != 6 {
		t.Fatalf("grouped names must point at their own lines: %+v %+v", current.Locations, legacy.Locations)
	}
	if groupedReference(references, referenceJavaClass, "com.discord.theme.next.ThemeManager", false) != nil {
		t.Fatal("a name inside HostClass must not also be checked on its own")
	}
	if standalone := groupedReference(references, referenceJavaClass, "com.discord.theme.ThemeManager", false); standalone == nil || standalone.Locations[0].Line != 10 {
		t.Fatalf("the same name outside HostClass must still be checked on its own: %+v", standalone)
	}
	surface := groupedReference(references, referenceJavaClass, "com.facebook.react.ReactSurface", true)
	if surface == nil || surface.Alternative != 1 || surface.Group != file.path+":8" {
		t.Fatalf("single-line HostClass names were not grouped: %+v", surface)
	}
	if groupedReference(references, referenceJavaClass, "com.discord.theme.DiscordTheme", true) != nil ||
		groupedReference(references, referenceJavaClass, "com.discord.theme.DiscordTheme", false) == nil {
		t.Fatal("a HostClass with one name has nothing to fall back to and must be checked on its own")
	}
}

func TestScriptFallbackExtraction(t *testing.T) {
	source := `import firstOf from '@unbound-app/utils/first-of';
import { findByProps } from '@unbound-app/api/metro';
const CURRENT = 'com.discord.span.next.ClickableSpan';
const LEGACY = 'com.discord.span.utilities.spannable.ClickableSpan';
const load = (name: string) => java.getClass(name);
const Forms = firstOf(
	() => findByProps('FormSlider'),
	() => findByProps('FormSliderRow'),
);
const span = firstOf(() => java.getClass(CURRENT), () => java.getClass(LEGACY));
const view = firstOf(() => load('com.discord.view.next.MessageView'), () => load('com.discord.chat.presentation.message.MessageView'));
const plain = findByProps('FormSliderRow');
`
	references := scriptReferences(t, "packages/plugins/demo/src/android/index.ts", source)

	slider := groupedReference(references, referenceProps, "FormSlider", true)
	row := groupedReference(references, referenceProps, "FormSliderRow", true)
	if slider == nil || row == nil || slider.Group != row.Group || slider.Alternative != 0 || row.Alternative != 1 {
		t.Fatalf("metro lookups inside firstOf were not grouped: %+v %+v", slider, row)
	}
	if slider.Group != "packages/plugins/demo/src/android/index.ts:6" {
		t.Fatalf("the group must be named after the firstOf call, got %q", slider.Group)
	}
	if groupedReference(references, referenceProps, "FormSliderRow", false) == nil {
		t.Fatal("a lookup outside firstOf must still be checked on its own")
	}
	current := groupedReference(references, referenceJavaClass, "com.discord.span.next.ClickableSpan", true)
	legacy := groupedReference(references, referenceJavaClass, "com.discord.span.utilities.spannable.ClickableSpan", true)
	if current == nil || legacy == nil || current.Group != legacy.Group || current.Alternative != 0 || legacy.Alternative != 1 {
		t.Fatalf("bridge lookups through constants were not grouped: %+v %+v", current, legacy)
	}
	next := groupedReference(references, referenceJavaClass, "com.discord.view.next.MessageView", true)
	old := groupedReference(references, referenceJavaClass, "com.discord.chat.presentation.message.MessageView", true)
	if next == nil || old == nil || next.Group != old.Group || next.Alternative != 0 || old.Alternative != 1 {
		t.Fatalf("lookups through a forwarder were not grouped: %+v %+v", next, old)
	}
}

func fallbackFinding(results *compatResults, name, group string) compatFinding {
	for _, finding := range results.Findings {
		reference := finding.Reference
		if (reference.Name == name || strings.Join(reference.Terms, ",") == name) && reference.Group == group {
			return finding
		}
	}
	return compatFinding{}
}

func TestEvaluateCompatFallbacks(t *testing.T) {
	location := []compatLocation{{File: "Themes.kt", Line: 1}}
	java := func(name, group string, alternative int) *compatReference {
		return &compatReference{Kind: referenceJavaClass, Name: name, Group: group, Alternative: alternative, Component: "loader-android", Locations: location}
	}
	references := []*compatReference{
		java("com.discord.next.View", "newer", 0),
		java("com.discord.View", "newer", 1),
		java("com.discord.View", "older", 0),
		java("com.discord.legacy.View", "older", 1),
		java("com.discord.next.View", "", 0),
		{Kind: referenceJavaClass, Name: "com.discord.View", Group: "partial", Component: "plugin:demo", Locations: location},
		{Kind: referenceJavaMethod, Class: "com.discord.View", Name: "setMessage", Parameters: []string{"int"}, Group: "partial", Component: "plugin:demo", Locations: location},
		{Kind: referenceStore, Name: "UserStore", Group: "partial", Alternative: 1, Component: "plugin:demo", Locations: location},
	}
	android := compatTestTargets()[1]
	results := evaluateCompat(references, []*compatTarget{android}, nil)

	expect := func(name, group, status, reason string) {
		t.Helper()
		finding := fallbackFinding(results, name, group)
		if finding.Status != status || !strings.Contains(finding.Reason, reason) {
			t.Fatalf("%s in %q: got %q (%s), want %q containing %q", name, group, finding.Status, finding.Reason, status, reason)
		}
	}
	expect("com.discord.next.View", "newer", compatFallback, "class `com.discord.View` resolves instead")
	expect("com.discord.View", "newer", compatOK, "")
	expect("com.discord.View", "older", compatOK, "")
	expect("com.discord.legacy.View", "older", compatFallback, "class `com.discord.View` resolves instead")
	expect("com.discord.next.View", "", compatBroken, "not in Discord's dex")
	expect("com.discord.View", "partial", compatOK, "")
	expect("setMessage", "partial", compatFallback, "store `UserStore` resolves instead")
	expect("UserStore", "partial", compatOK, "")

	report := renderCompatReport(results)
	if !strings.Contains(report, "<details><summary>Covered by a fallback (3)</summary>") || !strings.Contains(report, "A name listed here on every channel can be removed.") {
		t.Fatalf("the report must list names covered by a fallback:\n%s", report)
	}
	if !compatHasProblems(results) {
		t.Fatal("a name outside any fallback that is gone must still be a problem")
	}

	covered := evaluateCompat(append(references[:4:4], references[5:]...), []*compatTarget{android}, nil)
	if compatHasProblems(covered) {
		t.Fatalf("names covered by a fallback must not be problems: %+v", covered.Findings)
	}
	if status := covered.Platforms["android"].Statuses[references[0].key()]; status != compatFallback {
		t.Fatalf("the baseline must record covered names as covered, got %q", status)
	}
}

func TestEvaluateCompatFallbackWithNothingLeft(t *testing.T) {
	location := []compatLocation{{File: "a.ts", Line: 1}}
	references := []*compatReference{
		{Kind: referenceProps, Terms: []string{"FormSlider"}, Group: "forms", Component: "client", Locations: location},
		{Kind: referenceProps, Terms: []string{"FormSliderRow"}, Group: "forms", Alternative: 1, Component: "client", Locations: location},
	}
	results := evaluateCompat(references, compatTestTargets()[:1], nil)
	for _, name := range []string{"FormSlider", "FormSliderRow"} {
		finding := fallbackFinding(results, name, "forms")
		if finding.Status != compatBroken || !strings.HasSuffix(finding.Reason, ", and no fallback in its lookup resolves either") {
			t.Fatalf("%s: a lookup with no resolving name must stay broken and say so, got %+v", name, finding)
		}
	}
}
