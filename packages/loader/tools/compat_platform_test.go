package main

import (
	"encoding/binary"
	"strings"
	"testing"
)

func TestIOSSDKHeaderParser(t *testing.T) {
	index := newIOSSDKIndex()
	index.addHeader(`
#import <Foundation/Foundation.h>
@class UIColor;
@protocol UIDemoDelegate;
@protocol NSObject
- (BOOL)isEqual:(id)object;
@end

UIKIT_EXTERN API_AVAILABLE(ios(2.0))
@interface UIView : UIResponder <NSObject, NSCoding>
{
	id _ivar;
}
@property(nullable, nonatomic, copy) UIColor *backgroundColor UI_APPEARANCE_SELECTOR; // comment
@property(nonatomic, readonly, getter=isHidden) BOOL hidden;
@property(nonatomic, copy, nullable) void (^completion)(BOOL finished);
- (void)layoutSubviews;
- (void)insertSubview:(UIView *)view
         belowSubview:(UIView *)siblingSubview NS_SWIFT_NAME(insert(_:below:));
#if TARGET_OS_IOS
+ (UIView *)viewWithTintColor:(UIColor *)color API_AVAILABLE(ios(13.0));
#endif
@end

@interface UIView (UIViewHierarchy)
- (void)didMoveToWindow;
@end

@interface NSArray<__covariant ObjectType> : NSObject <NSCopying>
@end

@interface UITableViewCell : UIView <UIDemoDelegate>
@end
`)
	index.addTBD(`objc-classes:    [ UIView, _UIPrivateView, 
                       UITableViewCellContentView ]`)
	for _, selector := range []string{"backgroundColor", "setBackgroundColor:", "isHidden", "completion", "setCompletion:", "layoutSubviews", "insertSubview:belowSubview:", "viewWithTintColor:", "didMoveToWindow"} {
		if !index.Selectors[selector] {
			t.Errorf("selector %q was not indexed", selector)
		}
	}
	if index.Selectors["setHidden:"] {
		t.Error("a readonly property must not declare a setter")
	}
	if found, owner := index.declares("UITableViewCell", "didMoveToWindow"); !found || owner != "UIView" {
		t.Errorf("category methods must be inherited, got %v %q", found, owner)
	}
	if found, _ := index.declares("UITableViewCell", "isEqual:"); !found {
		t.Error("protocol methods must be inherited")
	}
	if index.Classes["NSArray"].Super != "NSObject" || index.Classes["UITableViewCell"].Super != "UIView" {
		t.Error("superclasses were not parsed")
	}
	if !index.hasClass("_UIPrivateView") || !index.hasClass("UITableViewCellContentView") || index.hasClass("UIAccessibility") {
		t.Error("exported classes from .tbd stubs were not indexed")
	}
	if index.Protocols["UIDemoDelegate"] != nil {
		t.Error("a forward protocol declaration must not define a protocol")
	}
}

func buildJavaClassFile(name, super string, fields [][2]string, methods [][2]string) []byte {
	var pool [][]byte
	utf8 := func(text string) int {
		entry := []byte{1, 0, 0}
		binary.BigEndian.PutUint16(entry[1:], uint16(len(text)))
		pool = append(pool, append(entry, text...))
		return len(pool)
	}
	class := func(text string) int {
		nameIndex := utf8(text)
		entry := []byte{7, 0, 0}
		binary.BigEndian.PutUint16(entry[1:], uint16(nameIndex))
		pool = append(pool, entry)
		return len(pool)
	}
	this := class(name)
	parent := class(super)
	pool = append(pool, []byte{5, 0, 0, 0, 0, 0, 0, 0, 1}, nil)
	type member struct{ name, descriptor int }
	var fieldEntries, methodEntries []member
	for _, field := range fields {
		fieldEntries = append(fieldEntries, member{utf8(field[0]), utf8(field[1])})
	}
	for _, method := range methods {
		methodEntries = append(methodEntries, member{utf8(method[0]), utf8(method[1])})
	}
	data := []byte{0xCA, 0xFE, 0xBA, 0xBE, 0, 0, 0, 52}
	u2 := func(value int) { data = binary.BigEndian.AppendUint16(data, uint16(value)) }
	u2(len(pool) + 1)
	for _, entry := range pool {
		data = append(data, entry...)
	}
	u2(0x21)
	u2(this)
	u2(parent)
	u2(0)
	for _, members := range [][]member{fieldEntries, methodEntries} {
		u2(len(members))
		for _, entry := range members {
			u2(1)
			u2(entry.name)
			u2(entry.descriptor)
			u2(0)
		}
	}
	u2(0)
	return data
}

func TestJavaClassFileReader(t *testing.T) {
	data := buildJavaClassFile("android/widget/TextView", "android/view/View",
		[][2]string{{"mText", "Ljava/lang/CharSequence;"}},
		[][2]string{{"onSizeChanged", "(IIII)V"}, {"setText", "(Ljava/lang/CharSequence;)V"}})
	class, err := parseJavaClassFile(data)
	if err != nil {
		t.Fatal(err)
	}
	if class.Name != "android.widget.TextView" || class.Super != "android.view.View" || !class.Fields["mText"] {
		t.Fatalf("class was not read: %+v", class)
	}
	if got := class.Methods["onSizeChanged"]; len(got) != 1 || got[0] != "IIII" {
		t.Fatalf("method descriptors were not read: %v", got)
	}
	if _, err := parseJavaClassFile([]byte("not a class")); err == nil {
		t.Fatal("garbage must fail")
	}

	index := newJavaFrameworkIndex()
	index.add(class)
	view, _ := parseJavaClassFile(buildJavaClassFile("android/view/View", "java/lang/Object", nil, [][2]string{{"layout", "(IIII)V"}}))
	index.add(view)
	if result, owner := index.lookupMethod("android.widget.TextView", "layout", "IIII"); result != dexFound || owner != "android.view.View" {
		t.Fatalf("inherited framework method was not found: %v %s", result, owner)
	}
	if result, _ := index.lookupMethod("android.widget.TextView", "setText", "I"); result != dexSignatureMismatch {
		t.Fatalf("a signature mismatch was not detected: %v", result)
	}
}

func TestKotlinOwnClasses(t *testing.T) {
	classes := parseKotlinClasses(`package app.unbound.android

import android.app.Activity

object ActivityTracker : Application.ActivityLifecycleCallbacks {
    @Volatile
    var generation: Long = 0
        private set

    fun currentActivity(): Activity? = current?.get()

    private fun <T> String.helper(value: T) = Unit

    class Snapshot(val id: String)

    data class Entry(
        val key: String,
    ) {
        fun describe() = "{" + key + "}"
    }
}
`)
	byName := map[string]*javaFrameworkClass{}
	for _, class := range classes {
		byName[class.Name] = class
	}
	tracker := byName["app.unbound.android.ActivityTracker"]
	if tracker == nil || !tracker.Fields["INSTANCE"] || tracker.Methods["currentActivity"] == nil || tracker.Methods["getGeneration"] == nil || tracker.Methods["setGeneration"] == nil || tracker.Methods["helper"] == nil {
		t.Fatalf("object members were not read: %+v", tracker)
	}
	if entry := byName["app.unbound.android.ActivityTracker$Entry"]; entry == nil || entry.Methods["describe"] == nil {
		t.Fatalf("nested class was not read: %+v", byName)
	}
	if tracker.Methods["describe"] != nil {
		t.Fatal("a nested class member must not leak into its outer class")
	}
}

func TestEvaluateCompatAgainstSDKs(t *testing.T) {
	targets := compatTestTargets()
	sdk := newIOSSDKIndex()
	sdk.addHeader(`@interface UIView : NSObject
- (void)layoutSubviews;
@end
@interface UILabel : UIView
- (void)setAttributedText:(id)text;
@end
@interface UIImage : NSObject
- (id)imageWithTintColor:(id)color;
@end`)
	targets[0].sdk = sdk
	framework := newJavaFrameworkIndex()
	view, _ := parseJavaClassFile(buildJavaClassFile("android/view/View", "java/lang/Object", nil, [][2]string{{"onSizeChanged", "(IIII)V"}}))
	framework.add(view)
	targets[1].framework = framework
	own := newJavaFrameworkIndex()
	for _, class := range parseKotlinClasses("package app.unbound.android\nobject ActivityTracker {\n    fun currentActivity() = null\n}\n") {
		own.add(class)
	}
	targets[1].own = own

	location := []compatLocation{{File: "a.ts", Line: 1}}
	references := []*compatReference{
		{Kind: referenceObjCMethod, Class: "DCDLabel", Name: "layoutSubviews", Component: "loader-ios", Locations: location},
		{Kind: referenceObjCMethod, Class: "DCDLabel", Name: "missingSelector", Component: "loader-ios", Locations: location},
		{Kind: referenceObjCMethod, Name: "imageWithTintColor:", Component: "plugin:demo", Locations: location},
		{Kind: referenceObjCClass, Name: "UIAccessibility", Component: "plugin:demo", Locations: location},
		{Kind: referenceObjCClass, Name: "LCSharedUtils", Component: "loader-ios", Locations: location},
		{Kind: referenceObjCMethod, Class: "UIView", Name: "layoutSubviews", Component: "plugin:demo", Locations: location},
		{Kind: referenceJavaMethod, Class: "com.discord.View", Name: "onSizeChanged", Parameters: []string{"int", "int", "int", "int"}, Component: "plugin:demo", Locations: location},
		{Kind: referenceJavaClass, Name: "app.unbound.android.ActivityTracker", Component: "plugin:demo", Locations: location},
		{Kind: referenceJavaClass, Name: "app.unbound.android.Gone", Component: "plugin:demo", Locations: location},
		{Kind: referenceJavaMethod, Name: "currentActivity", Component: "plugin:demo", Locations: location},
		{Kind: referenceJavaClass, Name: "android.app.ActivityThread", Component: "plugin:demo", Locations: location},
	}
	results := evaluateCompat(references, targets, nil)
	expect := func(platform, kind, name, status string) {
		t.Helper()
		if got := statusOf(results, platform, kind, name); got.Status != status {
			t.Fatalf("%s %s %s: got %q (%s), want %q", platform, kind, name, got.Status, got.Reason, status)
		}
	}
	expect("ios", referenceObjCMethod, "layoutSubviews", compatOK)
	expect("ios", referenceObjCMethod, "missingSelector", compatPossible)
	expect("ios", referenceObjCMethod, "imageWithTintColor:", compatOK)
	expect("ios", referenceObjCClass, "UIAccessibility", compatBroken)
	expect("ios", referenceObjCClass, "LCSharedUtils", compatExternal)
	expect("android", referenceJavaMethod, "onSizeChanged", compatOK)
	expect("android", referenceJavaClass, "app.unbound.android.ActivityTracker", compatOK)
	expect("android", referenceJavaClass, "app.unbound.android.Gone", compatBroken)
	expect("android", referenceJavaMethod, "currentActivity", compatOK)
	expect("android", referenceJavaClass, "android.app.ActivityThread", compatBroken)

	report := renderCompatReport(results)
	if !strings.Contains(report, "Outside Discord and the SDKs (1)") {
		t.Fatalf("environment-only classes must be listed:\n%s", report)
	}
}

func TestCompatReportListsSkippedSites(t *testing.T) {
	results := &compatResults{DynamicSites: []compatDynamicSite{{Component: "plugin:demo", Call: "objc.getClass", Location: compatLocation{File: "packages/plugins/demo/src/a.ts", Line: 4}}}}
	report := renderCompatReport(results)
	if !strings.Contains(report, "Not checked (1)") || !strings.Contains(report, "`objc.getClass` · `packages/plugins/demo/src/a.ts:4`") {
		t.Fatalf("skipped sites must be listed:\n%s", report)
	}
}
