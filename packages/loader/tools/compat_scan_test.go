package main

import (
	"encoding/binary"
	"sort"
	"strings"
	"testing"
)

func scriptReferences(t *testing.T, path, source string) []*compatReference {
	t.Helper()
	return scriptProgramReferences(t, map[string]string{path: source}).sorted()
}

func scriptProgramReferences(t *testing.T, sources map[string]string) *compatSourceSet {
	t.Helper()
	set := newCompatSourceSet()
	paths := make([]string, 0, len(sources))
	for path := range sources {
		paths = append(paths, path)
	}
	sort.Strings(paths)
	var files []*scriptFile
	for _, path := range paths {
		component, _ := compatComponent(path)
		file := compatSourceFile{path: path, component: component, platform: compatPlatform(path)}
		files = append(files, newScriptFile(file, scriptSourceRoot(path), tokenizeScript(sources[path])))
	}
	analyzeScripts(set, files)
	return set
}

func findReference(references []*compatReference, kind, name string) *compatReference {
	for _, reference := range references {
		if reference.Kind == kind && (reference.Name == name || strings.Join(reference.Terms, ",") == name) {
			return reference
		}
	}
	return nil
}

func TestCompatScriptExtraction(t *testing.T) {
	source := `import { findByProps } from '@unbound-app/api/metro';
const VIEW = 'com.discord.chat.presentation.message.MessageView';
const SIZE = ['int', 'int', 'int', 'int'] as const;
const Actions = findByProps('transitionToGuild', 'selectChannel', { lazy: true });
const Users = findStore('User');
const Raw = findStore('PermissionStore', { short: false });
const Sheet = findByFilePath('modules/messages/native/long_press/Sheet.tsx');
const Dynamic = findByProps(name);
hooks.hook(VIEW, 'onSizeChanged', SIZE, { notify: true }, () => {});
objc.hook('DCDLabel', 'setAttributedText:', {});
java.invoke(view, 'getId-3Eiw7ao', []);
const label = 'don\'t match this';
`
	references := scriptReferences(t, "packages/plugins/demo/src/android/index.ts", source)

	if reference := findReference(references, referenceProps, "transitionToGuild,selectChannel"); reference == nil || reference.Platform != "android" {
		t.Fatalf("props lookup was not extracted for Android: %+v", reference)
	}
	if findReference(references, referenceStore, "UserStore") == nil {
		t.Fatal("findStore must append Store")
	}
	if findReference(references, referenceStore, "PermissionStore") == nil || findReference(references, referenceStore, "PermissionStoreStore") != nil {
		t.Fatal("short: false must keep the store name")
	}
	if findReference(references, referenceModulePath, "modules/messages/native/long_press/Sheet.tsx") == nil {
		t.Fatal("module path was not extracted")
	}
	hook := findReference(references, referenceJavaMethod, "onSizeChanged")
	if hook == nil || hook.Class != "com.discord.chat.presentation.message.MessageView" || strings.Join(hook.Parameters, ",") != "int,int,int,int" {
		t.Fatalf("hook was not resolved through constants: %+v", hook)
	}
	if reference := findReference(references, referenceJavaClass, "com.discord.chat.presentation.message.MessageView"); reference == nil || !reference.Strict {
		t.Fatal("a hooked class must be recorded as strict")
	}
	if objc := findReference(references, referenceObjCMethod, "setAttributedText:"); objc == nil || objc.Class != "DCDLabel" {
		t.Fatalf("objc hook was not extracted: %+v", objc)
	}
	if findReference(references, referenceJavaMethod, "getId-3Eiw7ao") == nil {
		t.Fatal("java.invoke method name was not extracted")
	}
	if findReference(references, referenceModulePath, "@unbound-app/api/metro") != nil {
		t.Fatal("import specifiers must be ignored")
	}
}

func TestCompatLogosExtraction(t *testing.T) {
	set := newCompatSourceSet()
	source := "%hook AppDelegate\n- (BOOL)application:(UIApplication *)application\n    didFinishLaunchingWithOptions:(NSDictionary *)options\n{\n    return %orig;\n}\n- (void)layoutSubviews\n{\n}\n%end\nClass theme = NSClassFromString(@\"DCDThemeColor\");\n"
	file := compatSourceFile{path: "packages/loader/ios/sources/Demo.x", component: "loader-ios", platform: "ios"}
	extractNativeReferences(set, file, source)
	references := set.sorted()

	if reference := findReference(references, referenceObjCMethod, "application:didFinishLaunchingWithOptions:"); reference == nil || reference.Class != "AppDelegate" {
		t.Fatalf("multi-line selector was not joined: %+v", references)
	}
	if findReference(references, referenceObjCMethod, "layoutSubviews") == nil {
		t.Fatal("zero-argument selector was not extracted")
	}
	if reference := findReference(references, referenceObjCClass, "AppDelegate"); reference == nil || !reference.Strict {
		t.Fatal("hooked class must be strict")
	}
	if reference := findReference(references, referenceObjCClass, "DCDThemeColor"); reference == nil || reference.Strict {
		t.Fatal("NSClassFromString lookup must be recorded without strictness")
	}
}

func buildHermesBundle(entries []string, identifiers int) []byte {
	var storage []byte
	small := make([]uint32, len(entries))
	for index, entry := range entries {
		small[index] = uint32(len(storage))<<1 | uint32(len(entry))<<24
		storage = append(storage, entry...)
	}
	kinds := []uint32{1<<31 | uint32(identifiers), uint32(len(entries) - identifiers)}

	data := make([]byte, 128)
	binary.LittleEndian.PutUint64(data, hermesMagic)
	binary.LittleEndian.PutUint32(data[8:], 98)
	binary.LittleEndian.PutUint32(data[44:], uint32(len(kinds)))
	binary.LittleEndian.PutUint32(data[48:], uint32(identifiers))
	binary.LittleEndian.PutUint32(data[52:], uint32(len(entries)))
	binary.LittleEndian.PutUint32(data[60:], uint32(len(storage)))
	appendWord := func(value uint32) {
		data = binary.LittleEndian.AppendUint32(data, value)
	}
	for _, kind := range kinds {
		appendWord(kind)
	}
	for index := 0; index < identifiers; index++ {
		appendWord(0)
	}
	for _, entry := range small {
		appendWord(entry)
	}
	return append(data, storage...)
}

func TestParseHermesStrings(t *testing.T) {
	table, err := parseHermesStrings(buildHermesBundle([]string{"transitionToGuild", "UserStore", "modules/a.tsx"}, 1))
	if err != nil {
		t.Fatal(err)
	}
	if !table.has("UserStore") || !table.has("modules/a.tsx") || table.has("missing") {
		t.Fatal("string table was not decoded")
	}
	if !table.isIdentifier("transitionToGuild") || table.isIdentifier("UserStore") {
		t.Fatal("string kinds were not applied")
	}
	if _, err := parseHermesStrings([]byte("not hermes")); err == nil {
		t.Fatal("non-Hermes input must fail")
	}
}

func TestCompatDescriptorsAndNames(t *testing.T) {
	if got := javaParameterDescriptors([]string{"int", "java.lang.String", "byte[]", "android.text.Spannable$Factory"}); got != "ILjava/lang/String;[BLandroid/text/Spannable$Factory;" {
		t.Fatalf("unexpected descriptors %q", got)
	}
	if got := demangleObjCClassName("_TtC6Sentry9SentrySDK"); got != "Sentry.SentrySDK" {
		t.Fatalf("unexpected demangled name %q", got)
	}
	if got := demangleObjCClassName("DCDLabel"); got != "DCDLabel" {
		t.Fatalf("plain names must stay unchanged, got %q", got)
	}
	if !isAppleClassName("UIApplication") || !isAppleClassName("NSError") || isAppleClassName("DCDTheme") || isAppleClassName("SentrySDK") {
		t.Fatal("Apple class detection is wrong")
	}
}

func compatTestTargets() []*compatTarget {
	hermes := &hermesStrings{
		strings:     map[string]bool{"UserStore": true, "transitionToGuild": true, "plainOnly": true},
		identifiers: map[string]bool{"transitionToGuild": true},
	}
	objc := newObjCIndex()
	objc.Classes["DCDLabel"] = &objcClass{Name: "DCDLabel", Super: "UILabel", SuperExternal: true, Methods: map[string]bool{"setAttributedText:": true}}
	objc.Selectors["setAttributedText:"] = true
	dex := newDexIndex()
	dex.Classes["com.discord.View"] = &dexClass{Name: "com.discord.View", Super: "android.view.View", Methods: map[string][]string{"setMessage": {"Lcom/discord/Message;"}}, Fields: map[string]bool{}}
	dex.MethodNames["setMessage"] = true
	return []*compatTarget{
		{Platform: "ios", Version: "1", hermes: hermes, objc: objc},
		{Platform: "android", Version: "1", hermes: hermes, dex: dex},
	}
}

func statusOf(results *compatResults, platform, kind, name string) compatFinding {
	for _, finding := range results.Findings {
		reference := finding.Reference
		if finding.Platform == platform && reference.Kind == kind && (reference.Name == name || strings.Join(reference.Terms, ",") == name) {
			return finding
		}
	}
	return compatFinding{}
}

func TestEvaluateCompat(t *testing.T) {
	location := []compatLocation{{File: "a.ts", Line: 1}}
	references := []*compatReference{
		{Kind: referenceStore, Name: "UserStore", Component: "client", Locations: location},
		{Kind: referenceStore, Name: "GoneStore", Component: "client", Locations: location},
		{Kind: referenceProps, Terms: []string{"transitionToGuild", "plainOnly"}, Component: "client", Locations: location},
		{Kind: referenceObjCClass, Name: "DCDTheme", Strict: true, Component: "loader-ios", Locations: location},
		{Kind: referenceObjCClass, Name: "UIApplication", Strict: true, Component: "loader-ios", Locations: location},
		{Kind: referenceObjCMethod, Class: "DCDLabel", Name: "layoutSubviews", Component: "loader-ios", Locations: location},
		{Kind: referenceJavaMethod, Class: "com.discord.View", Name: "setMessage", Parameters: []string{"int"}, Component: "plugin:demo", Locations: location},
		{Kind: referenceJavaMethod, Name: "getId-3Eiw7ao", Component: "plugin:demo", Locations: location},
		{Kind: referenceJavaField, Name: "currentEmojiId", Component: "plugin:demo", Locations: location},
	}
	results := evaluateCompat(references, compatTestTargets(), nil)

	expect := func(platform, kind, name, status string) {
		t.Helper()
		if got := statusOf(results, platform, kind, name); got.Status != status {
			t.Fatalf("%s %s %s: got %q (%s), want %q", platform, kind, name, got.Status, got.Reason, status)
		}
	}
	expect("ios", referenceStore, "UserStore", compatOK)
	expect("android", referenceStore, "GoneStore", compatBroken)
	expect("ios", referenceProps, "transitionToGuild,plainOnly", compatPossible)
	expect("ios", referenceObjCClass, "DCDTheme", compatBroken)
	expect("ios", referenceObjCClass, "UIApplication", "")
	expect("ios", referenceObjCMethod, "layoutSubviews", compatUnverified)
	expect("android", referenceJavaMethod, "setMessage", compatBroken)
	expect("android", referenceJavaMethod, "getId-3Eiw7ao", compatBroken)
	expect("android", referenceJavaField, "currentEmojiId", compatUnverified)

	baseline := &compatResults{Platforms: map[string]*compatPlatformState{
		"android": {Seen: []string{references[8].key()}, Statuses: map[string]string{references[8].key(): compatOK}},
	}}
	regressed := evaluateCompat(references, compatTestTargets(), baseline)
	finding := statusOf(regressed, "android", referenceJavaField, "currentEmojiId")
	if finding.Status != compatBroken || !finding.New {
		t.Fatalf("a field seen before must regress to new and broken, got %+v", finding)
	}

	report := renderCompatReport(regressed)
	for _, expected := range []string{"### Definitely broken", "### Possibly broken", "store `GoneStore`", "**new**", "Not verifiable"} {
		if !strings.Contains(report, expected) {
			t.Fatalf("report is missing %q:\n%s", expected, report)
		}
	}
	if !compatHasProblems(regressed) {
		t.Fatal("problems were not detected")
	}
}

func TestEvaluateCompatScansASinglePlatformBuild(t *testing.T) {
	location := []compatLocation{{File: "a.ts", Line: 1}}
	references := []*compatReference{
		{Kind: referenceStore, Name: "UserStore", Component: "client", Locations: location},
		{Kind: referenceObjCClass, Name: "DCDTheme", Strict: true, Component: "loader-ios", Locations: location},
		{Kind: referenceJavaMethod, Class: "com.discord.View", Name: "setMessage", Parameters: []string{"com.discord.Message"}, Component: "plugin:demo", Locations: location},
	}
	android := compatTestTargets()[1]
	android.Version = "352.8"
	baseline := &compatResults{Platforms: map[string]*compatPlatformState{
		"ios": {Seen: []string{references[1].key()}, Statuses: map[string]string{references[1].key(): compatOK}},
	}}
	results := evaluateCompat(references, []*compatTarget{android}, baseline)
	results.Channel = "alpha"
	if _, scanned := results.Platforms["ios"]; scanned || results.Platforms["android"] == nil {
		t.Fatalf("an Android-only scan must only record Android state, got %v", results.Platforms)
	}
	for _, finding := range results.Findings {
		if finding.Platform != "android" {
			t.Fatalf("an Android-only scan reported %+v", finding)
		}
	}
	if compatHasProblems(results) {
		t.Fatalf("an Android-only scan must not inherit iOS problems: %+v", results.Findings)
	}
	report := renderCompatReport(results)
	if !strings.Contains(report, "## Discord compatibility scan (alpha)\n\nAndroid 352.8\n") || strings.Contains(report, "| iOS |") {
		t.Fatalf("the report must only describe the Android build:\n%s", report)
	}
	if versions := compatIssueVersions(results); versions != "Android 352.8" {
		t.Fatalf("issue versions are %q, want Android 352.8", versions)
	}
	if plan := planCompatIssue(nil, "alpha", compatIssueVersions(results), true); plan.Title != "Discord compatibility (alpha): Android 352.8" {
		t.Fatalf("issue title is %q", plan.Title)
	}
}
