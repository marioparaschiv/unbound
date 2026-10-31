package main

import (
	"encoding/binary"
	"path/filepath"
	"reflect"
	"runtime"
	"slices"
	"strings"
	"testing"
)

type testDexMember struct {
	name       string
	descriptor string
	parameters []string
	static     bool
}

type testDexClass struct {
	name       string
	super      string
	interfaces []string
	fields     []testDexMember
	methods    []testDexMember
}

func appendUleb128(data []byte, value uint32) []byte {
	for {
		next := byte(value & 0x7F)
		value >>= 7
		if value == 0 {
			return append(data, next)
		}
		data = append(data, next|0x80)
	}
}

func buildTestDex(classes []testDexClass) []byte {
	var texts, types []string
	stringIndex, typeIndex := map[string]int{}, map[string]int{}
	text := func(value string) int {
		if index, ok := stringIndex[value]; ok {
			return index
		}
		stringIndex[value] = len(texts)
		texts = append(texts, value)
		return stringIndex[value]
	}
	typeOf := func(descriptor string) int {
		if index, ok := typeIndex[descriptor]; ok {
			return index
		}
		text(descriptor)
		typeIndex[descriptor] = len(types)
		types = append(types, descriptor)
		return typeIndex[descriptor]
	}
	type fieldID struct{ class, fieldType, name int }
	type methodID struct{ class, proto, name int }
	type protoID struct {
		parameters []string
		returns    string
	}
	var protos []protoID
	var fields []fieldID
	var methods []methodID
	type classLayout struct {
		class, super       int
		interfaces         []int
		staticFields       []int
		instanceFields     []int
		direct, virtual    []int
		directFlags        []uint32
		virtualFlags       []uint32
		staticFieldFlags   []uint32
		instanceFieldFlags []uint32
	}
	var layouts []classLayout
	for _, class := range classes {
		layout := classLayout{class: typeOf(javaTypeDescriptor(class.name)), super: typeOf(javaTypeDescriptor(class.super))}
		for _, name := range class.interfaces {
			layout.interfaces = append(layout.interfaces, typeOf(javaTypeDescriptor(name)))
		}
		for _, static := range []bool{true, false} {
			for _, field := range class.fields {
				if field.static != static {
					continue
				}
				fields = append(fields, fieldID{class: layout.class, fieldType: typeOf(field.descriptor), name: text(field.name)})
				if static {
					layout.staticFields = append(layout.staticFields, len(fields)-1)
					layout.staticFieldFlags = append(layout.staticFieldFlags, dexStaticFlag)
				} else {
					layout.instanceFields = append(layout.instanceFields, len(fields)-1)
					layout.instanceFieldFlags = append(layout.instanceFieldFlags, 0)
				}
			}
		}
		for _, direct := range []bool{true, false} {
			for _, method := range class.methods {
				isDirect := method.static || method.name == dexConstructorName
				if isDirect != direct {
					continue
				}
				for _, parameter := range method.parameters {
					typeOf(parameter)
				}
				returns := method.descriptor
				if returns == "" {
					returns = "V"
				}
				typeOf(returns)
				protos = append(protos, protoID{parameters: method.parameters, returns: returns})
				methods = append(methods, methodID{class: layout.class, proto: len(protos) - 1, name: text(method.name)})
				flags := uint32(0)
				if method.static {
					flags = dexStaticFlag
				}
				if direct {
					layout.direct = append(layout.direct, len(methods)-1)
					layout.directFlags = append(layout.directFlags, flags)
				} else {
					layout.virtual = append(layout.virtual, len(methods)-1)
					layout.virtualFlags = append(layout.virtualFlags, flags)
				}
			}
		}
		layouts = append(layouts, layout)
	}

	order := binary.LittleEndian
	stringsOffset := 0x70
	typesOffset := stringsOffset + 4*len(texts)
	protosOffset := typesOffset + 4*len(types)
	fieldsOffset := protosOffset + 12*len(protos)
	methodsOffset := fieldsOffset + 8*len(fields)
	classesOffset := methodsOffset + 8*len(methods)
	data := make([]byte, classesOffset+32*len(layouts))
	copy(data, "dex\n035\x00")
	for index, value := range []int{len(texts), stringsOffset, len(types), typesOffset, len(protos), protosOffset, len(fields), fieldsOffset, len(methods), methodsOffset, len(layouts), classesOffset} {
		order.PutUint32(data[0x38+4*index:], uint32(value))
	}
	align := func() {
		for len(data)%4 != 0 {
			data = append(data, 0)
		}
	}
	typeList := func(items []int) int {
		if len(items) == 0 {
			return 0
		}
		align()
		offset := len(data)
		data = order.AppendUint32(data, uint32(len(items)))
		for _, item := range items {
			data = order.AppendUint16(data, uint16(item))
		}
		return offset
	}
	for index, value := range texts {
		order.PutUint32(data[stringsOffset+4*index:], uint32(len(data)))
		data = appendUleb128(data, uint32(len(value)))
		data = append(append(data, value...), 0)
	}
	for index, descriptor := range types {
		order.PutUint32(data[typesOffset+4*index:], uint32(stringIndex[descriptor]))
	}
	for index, proto := range protos {
		var items []int
		for _, parameter := range proto.parameters {
			items = append(items, typeIndex[parameter])
		}
		base := protosOffset + 12*index
		order.PutUint32(data[base+4:], uint32(typeIndex[proto.returns]))
		order.PutUint32(data[base+8:], uint32(typeList(items)))
	}
	for index, field := range fields {
		base := fieldsOffset + 8*index
		order.PutUint16(data[base:], uint16(field.class))
		order.PutUint16(data[base+2:], uint16(field.fieldType))
		order.PutUint32(data[base+4:], uint32(field.name))
	}
	for index, method := range methods {
		base := methodsOffset + 8*index
		order.PutUint16(data[base:], uint16(method.class))
		order.PutUint16(data[base+2:], uint16(method.proto))
		order.PutUint32(data[base+4:], uint32(method.name))
	}
	for index, layout := range layouts {
		base := classesOffset + 32*index
		order.PutUint32(data[base:], uint32(layout.class))
		order.PutUint32(data[base+8:], uint32(layout.super))
		order.PutUint32(data[base+12:], uint32(typeList(layout.interfaces)))
		classData := len(data)
		for _, count := range []int{len(layout.staticFields), len(layout.instanceFields), len(layout.direct), len(layout.virtual)} {
			data = appendUleb128(data, uint32(count))
		}
		encode := func(ids []int, flags []uint32, method bool) {
			previous := 0
			for position, id := range ids {
				data = appendUleb128(data, uint32(id-previous))
				data = appendUleb128(data, flags[position])
				if method {
					data = appendUleb128(data, 0)
				}
				previous = id
			}
		}
		encode(layout.staticFields, layout.staticFieldFlags, false)
		encode(layout.instanceFields, layout.instanceFieldFlags, false)
		encode(layout.direct, layout.directFlags, true)
		encode(layout.virtual, layout.virtualFlags, true)
		order.PutUint32(data[base+24:], uint32(classData))
	}
	return data
}

func TestDexDeclaredMembers(t *testing.T) {
	data := buildTestDex([]testDexClass{{
		name:       "com.discord.View",
		super:      "android.widget.LinearLayout",
		interfaces: []string{"android.text.style.LineBackgroundSpan"},
		fields: []testDexMember{
			{name: "messageId", descriptor: "Ljava/lang/String;"},
			{name: "COUNT", descriptor: "I", static: true},
		},
		methods: []testDexMember{
			{name: dexConstructorName, parameters: []string{"I", "[I"}},
			{name: "bind", parameters: []string{"Lcom/discord/Message;", "Z"}},
			{name: "create", descriptor: "Lcom/discord/View;", parameters: nil, static: true},
		},
	}})
	index := newDexIndex()
	if err := addDexToIndex(index, data); err != nil {
		t.Fatal(err)
	}
	class := index.Classes["com.discord.View"]
	if class == nil || class.Super != "android.widget.LinearLayout" || !reflect.DeepEqual(class.Interfaces, []string{"android.text.style.LineBackgroundSpan"}) {
		t.Fatalf("unexpected class %+v", class)
	}
	if !reflect.DeepEqual(class.Constructors, [][]string{{"int", "[I"}}) {
		t.Fatalf("constructors must use Java runtime names: %+v", class.Constructors)
	}
	want := []dexMember{
		{Name: "COUNT", Field: true, Static: true, Type: "int"},
		{Name: "messageId", Field: true, Type: "java.lang.String"},
		{Name: "create", Static: true, Returns: "com.discord.View", Parameters: []string{}},
		{Name: "bind", Returns: "void", Parameters: []string{"com.discord.Message", "boolean"}},
	}
	if !reflect.DeepEqual(class.Declared, want) {
		t.Fatalf("got %+v, want %+v", class.Declared, want)
	}
	if got := class.Methods["bind"]; !reflect.DeepEqual(got, []string{"Lcom/discord/Message;Z"}) {
		t.Fatalf("method signatures must keep their descriptors: %v", got)
	}
}

func boolPointer(value bool) *bool { return &value }

func intPointer(value int) *int { return &value }

func shapeTestTarget(shapes map[string]discordShape, classes ...*dexClass) *compatTarget {
	dex := newDexIndex()
	for _, class := range classes {
		dex.Classes[class.Name] = class
	}
	return &compatTarget{Platform: "android", Version: "1", dex: dex, shapes: shapes}
}

func TestEvaluateShapeReference(t *testing.T) {
	message := "com.discord.chat.bridge.Message"
	shapes := map[string]discordShape{
		"bind":       {Owner: "com.discord.MessageView", Member: shapeMethod, Static: boolPointer(false), FirstParameter: message, Pick: shapePickLongest},
		"messageId":  {Owner: "com.discord.MessageView", Member: shapeField, Static: boolPointer(false), Type: "java.lang.String", Pick: shapePickOnly},
		"setter":     {Owner: "com.discord.MessageView", Member: shapeMethod, Name: "setText", ParameterCount: intPointer(1), Pick: shapePickOnly},
		"background": {Implements: "android.text.style.LineBackgroundSpan", Member: shapeConstructor, Parameters: []string{"int", "int"}, Pick: shapePickOnly},
		"reaction":   {Extends: "android.widget.LinearLayout", WithFields: []string{"java.lang.Integer"}, Member: shapeField, Static: boolPointer(false), Type: "java.lang.String", Pick: shapePickOnly},
	}
	view := &dexClass{Name: "com.discord.MessageView", Declared: []dexMember{
		{Name: "a", Parameters: []string{message, "x"}},
		{Name: "b", Parameters: []string{message, "x", "y"}},
		{Name: "c", Static: true, Parameters: []string{message, "x", "y", "z"}},
		{Name: "id", Field: true, Type: "java.lang.String"},
		{Name: "TAG", Field: true, Static: true, Type: "java.lang.String"},
		{Name: "setText", Parameters: []string{"a.b"}},
		{Name: "setText", Parameters: []string{"a.b", "int"}},
	}}
	span := &dexClass{Name: "lh.b", Interfaces: []string{"android.text.style.LineBackgroundSpan"}, Constructors: [][]string{{"int", "int"}}}
	drawer := &dexClass{Name: "jh.a", Interfaces: []string{"android.text.style.LineBackgroundSpan"}, Constructors: [][]string{{"android.widget.TextView"}}}
	reaction := &dexClass{Name: "gg.b", Super: "android.widget.LinearLayout", Declared: []dexMember{
		{Name: "e", Field: true, Type: "java.lang.Integer"},
		{Name: "i", Field: true, Type: "java.lang.String"},
	}}
	other := &dexClass{Name: "x9.a", Super: "android.widget.LinearLayout", Declared: []dexMember{{Name: "v", Field: true, Type: "java.lang.String"}}}

	expect := func(target *compatTarget, name, status, reason string) {
		t.Helper()
		got, why := evaluateShapeReference(&compatReference{Kind: referenceJavaShape, Name: name}, target)
		if got != status || !strings.Contains(why, reason) {
			t.Fatalf("shape %s: got %q (%s), want %q containing %q", name, got, why, status, reason)
		}
	}

	matching := shapeTestTarget(shapes, view, span, drawer, reaction, other)
	for _, name := range []string{"bind", "messageId", "setter", "background", "reaction"} {
		expect(matching, name, compatOK, "")
	}
	expect(matching, "missing", compatBroken, "has no shape `missing`")
	expect(shapeTestTarget(shapes), "bind", compatBroken, "class `com.discord.MessageView` is not in Discord's dex")

	tied := &dexClass{Name: view.Name, Declared: []dexMember{
		{Name: "a", Parameters: []string{message, "x"}},
		{Name: "b", Parameters: []string{message, "y"}},
		{Name: "id", Field: true, Type: "java.lang.String"},
		{Name: "author", Field: true, Type: "java.lang.String"},
	}}
	ambiguous := shapeTestTarget(shapes, tied)
	expect(ambiguous, "bind", compatBroken, "several members of `com.discord.MessageView` fit")
	expect(ambiguous, "messageId", compatBroken, "`id`, `author`, so the lookup is ambiguous")
	expect(ambiguous, "setter", compatBroken, "has no method `setText` with 1 parameter")

	expect(shapeTestTarget(shapes, drawer), "background", compatBroken, "no class implementing `android.text.style.LineBackgroundSpan` has one constructor")
	twoSpans := &dexClass{Name: "lh.c", Interfaces: span.Interfaces, Constructors: span.Constructors}
	expect(shapeTestTarget(shapes, span, twoSpans), "background", compatBroken, "`lh.b`, `lh.c`, so the lookup is ambiguous")
	expect(shapeTestTarget(shapes, other), "reaction", compatBroken, "with `java.lang.Integer` fields")
}

func TestEvaluateCompatShapes(t *testing.T) {
	location := []compatLocation{{File: "packages/plugins-shared/src/native/android/discord-views.ts", Line: 3}}
	references := []*compatReference{
		{Kind: referenceJavaShape, Name: "messageId", Component: "plugins-shared", Locations: location},
		{Kind: referenceResource, Class: "id", Name: "author_name", Component: "plugins-shared", Locations: location},
		{Kind: referenceResource, Class: "id", Name: "gone", Component: "plugins-shared", Locations: location},
	}
	target := shapeTestTarget(map[string]discordShape{
		"messageId": {Owner: "com.discord.MessageView", Member: shapeField, Type: "java.lang.String", Pick: shapePickOnly},
	}, &dexClass{Name: "com.discord.MessageView"})
	target.resources = &androidResources{names: map[string]map[string]bool{discordPackageName: {"id/author_name": true}}}
	results := evaluateCompat(references, []*compatTarget{target}, nil)

	if got := statusOf(results, "android", referenceJavaShape, "messageId"); got.Status != compatBroken || !strings.Contains(got.Reason, "has no field") {
		t.Fatalf("a shape nothing fits must be broken: %+v", got)
	}
	if got := statusOf(results, "android", referenceResource, "author_name"); got.Status != compatOK {
		t.Fatalf("a resource Discord has must resolve: %+v", got)
	}
	if got := statusOf(results, "android", referenceResource, "gone"); got.Status != compatBroken || !strings.Contains(got.Reason, "no `id` resource named `gone`") {
		t.Fatalf("a missing resource must be broken: %+v", got)
	}
	if compatBreakageError(results) == nil {
		t.Fatal("broken shapes and resources must fail the release gate")
	}
	report := renderCompatReport(results)
	for _, line := range []string{"- shape `messageId` (Android)", "- resource `id/gone` (Android)", "discord-views.ts:3"} {
		if !strings.Contains(report, line) {
			t.Fatalf("report is missing %q:\n%s", line, report)
		}
	}
	if state := results.Platforms["android"]; state.Statuses[references[0].key()] != compatBroken || !slices.Contains(state.Seen, references[1].key()) {
		t.Fatalf("shapes and resources must feed the baseline: %+v", state)
	}

	target.resources = nil
	if got := statusOf(evaluateCompat(references[1:2], []*compatTarget{target}, nil), "android", referenceResource, "author_name"); got.Status != compatUnverified {
		t.Fatalf("an APK without a resource table cannot verify resources: %+v", got)
	}
}

func TestScriptShapeExtraction(t *testing.T) {
	set := scriptProgramReferences(t, map[string]string{
		"packages/plugins-shared/src/native/android/discord-views.ts": `
import { shapeField, shapeMethod } from '@unbound-plugins/shared/native/android/discord-shapes';

export function messageBindMethod(java: NativeJavaBridge) {
	return shapeMethod(java, 'messageBind');
}

export function fieldOf(java: NativeJavaBridge, shape: string, className: string) {
	return shapeField(java, shape, className);
}

export function viewByIdName(java: NativeJavaBridge, view: NativeJavaReference, name: string) {
	return java.invoke(view, 'findViewById', []);
}
`,
		"packages/plugins/demo/src/android/index.ts": `
import { fieldOf, viewByIdName } from '@unbound-plugins/shared/native/android/discord-views';
import { hasShapeConstructor } from '@unbound-plugins/shared/native/android/discord-shapes';

const HEADER = 'header';

export function start(java: NativeJavaBridge, view: NativeJavaReference, name: string) {
	fieldOf(java, 'reactionEmoji', 'x');
	hasShapeConstructor(java, 'blockBackgroundSpan', name);
	viewByIdName(java, view, HEADER);
	viewByIdName(java, view, 'author_name');
}
`,
	})
	expectKeys(t, set, []string{
		"java-shape  messageBind",
		"java-shape  reactionEmoji",
		"java-shape  blockBackgroundSpan",
		"android-resource id header",
		"android-resource id author_name",
	}, []string{"java-shape  shape", "android-resource id name"})
	expectNoDynamic(t, set)
	for _, reference := range set.sorted() {
		if reference.Kind == referenceJavaShape && reference.Name == "messageBind" && (reference.Component != "plugins-shared" || reference.Locations[0].Line != 5) {
			t.Fatalf("a shape must be reported where the helper names it: %+v", reference)
		}
		if reference.Kind == referenceJavaShape && reference.Name == "reactionEmoji" && reference.Component != "plugin:demo" {
			t.Fatalf("a shape named through a forwarder belongs to its caller: %+v", reference)
		}
	}
}

type testResourceType struct {
	name    string
	entries []string
	flags   byte
	compact bool
}

func buildTestStringPool(values []string) []byte {
	header := 28
	pool := make([]byte, header+4*len(values))
	var storage []byte
	for index, value := range values {
		binary.LittleEndian.PutUint32(pool[header+4*index:], uint32(len(storage)))
		storage = append(storage, byte(len(value)), byte(len(value)))
		storage = append(append(storage, value...), 0)
	}
	for len(storage)%4 != 0 {
		storage = append(storage, 0)
	}
	binary.LittleEndian.PutUint16(pool, resourceStringPool)
	binary.LittleEndian.PutUint16(pool[2:], uint16(header))
	binary.LittleEndian.PutUint32(pool[8:], uint32(len(values)))
	binary.LittleEndian.PutUint32(pool[16:], binaryXMLUTF8Flag)
	binary.LittleEndian.PutUint32(pool[20:], uint32(len(pool)))
	pool = append(pool, storage...)
	binary.LittleEndian.PutUint32(pool[4:], uint32(len(pool)))
	return pool
}

func buildTestResourceType(id int, kind testResourceType, keys map[string]int) []byte {
	order := binary.LittleEndian
	header := 20 + 64
	width := 4
	if kind.flags&resourceOffset16Flag != 0 {
		width = 2
	}
	count := len(kind.entries) + 1
	entriesStart := header + count*width
	chunk := make([]byte, entriesStart)
	order.PutUint16(chunk, resourceTypeChunk)
	order.PutUint16(chunk[2:], uint16(header))
	chunk[8], chunk[9] = byte(id), kind.flags
	order.PutUint32(chunk[12:], uint32(count))
	order.PutUint32(chunk[16:], uint32(entriesStart))
	order.PutUint32(chunk[20:], 64)
	if kind.flags&resourceSparseFlag != 0 {
		order.PutUint32(chunk[12:], uint32(len(kind.entries)))
		entriesStart = header + len(kind.entries)*4
		order.PutUint32(chunk[16:], uint32(entriesStart))
		chunk = chunk[:entriesStart]
	}
	var entries []byte
	for index, name := range append([]string{""}, kind.entries...) {
		slot := header + index*width
		switch {
		case kind.flags&resourceSparseFlag != 0:
			if index == 0 {
				continue
			}
			slot = header + (index-1)*4
			order.PutUint16(chunk[slot:], uint16(index))
			order.PutUint16(chunk[slot+2:], uint16(len(entries)/4))
		case name == "" && width == 2:
			order.PutUint16(chunk[slot:], resourceNoEntry16)
			continue
		case name == "":
			order.PutUint32(chunk[slot:], resourceNoEntry32)
			continue
		case width == 2:
			order.PutUint16(chunk[slot:], uint16(len(entries)/4))
		default:
			order.PutUint32(chunk[slot:], uint32(len(entries)))
		}
		entry := make([]byte, 16)
		if kind.compact {
			order.PutUint16(entry, uint16(keys[name]))
			order.PutUint16(entry[2:], resourceCompactFlag)
			entry = entry[:8]
		} else {
			order.PutUint16(entry, 8)
			order.PutUint32(entry[4:], uint32(keys[name]))
		}
		entries = append(entries, entry...)
	}
	chunk = append(chunk, entries...)
	order.PutUint32(chunk[4:], uint32(len(chunk)))
	return chunk
}

func buildTestResourceTable(packageName string, kinds []testResourceType) []byte {
	order := binary.LittleEndian
	var typeNames, keyNames []string
	keys := map[string]int{}
	for _, kind := range kinds {
		typeNames = append(typeNames, kind.name)
		for _, entry := range kind.entries {
			if _, ok := keys[entry]; !ok {
				keys[entry] = len(keyNames)
				keyNames = append(keyNames, entry)
			}
		}
	}
	pkg := make([]byte, resourcePackageMinSize)
	order.PutUint16(pkg, resourcePackageChunk)
	order.PutUint16(pkg[2:], resourcePackageMinSize)
	order.PutUint32(pkg[8:], 0x7f)
	for index, unit := range packageName {
		order.PutUint16(pkg[12+2*index:], uint16(unit))
	}
	order.PutUint32(pkg[268:], uint32(len(pkg)))
	pkg = append(pkg, buildTestStringPool(typeNames)...)
	order.PutUint32(pkg[276:], uint32(len(pkg)))
	pkg = append(pkg, buildTestStringPool(keyNames)...)
	for index, kind := range kinds {
		pkg = append(pkg, buildTestResourceType(index+1, kind, keys)...)
	}
	order.PutUint32(pkg[4:], uint32(len(pkg)))
	table := make([]byte, 12)
	order.PutUint16(table, resourceTableChunk)
	order.PutUint16(table[2:], 12)
	order.PutUint32(table[8:], 1)
	table = append(table, buildTestStringPool(nil)...)
	table = append(table, pkg...)
	order.PutUint32(table[4:], uint32(len(table)))
	return table
}

func TestParseResourceTable(t *testing.T) {
	data := buildTestResourceTable(discordPackageName, []testResourceType{
		{name: "id", entries: []string{"author_name", "header"}},
		{name: "layout", entries: []string{"accessories_view"}, flags: resourceOffset16Flag},
		{name: "string", entries: []string{"title"}, flags: resourceSparseFlag},
		{name: "color", entries: []string{"brand_dark"}, compact: true},
	})
	resources, err := parseResourceTable(data)
	if err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"id/author_name", "id/header", "layout/accessories_view", "string/title", "color/brand_dark"} {
		kind, entry, _ := strings.Cut(name, "/")
		if !resources.has(discordPackageName, kind, entry) {
			t.Errorf("missing %s in %v", name, resources.names)
		}
	}
	if resources.has(discordPackageName, "id", "accessories_view") || resources.has("com.other", "id", "header") {
		t.Fatalf("resources must be told apart by type and package: %v", resources.names)
	}
	if _, err := parseResourceTable([]byte("not a table")); err == nil {
		t.Fatal("garbage must not parse as a resource table")
	}
}

func TestDiscordShapesMatchTheHelpers(t *testing.T) {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not locate test source")
	}
	root := filepath.Join(filepath.Dir(filename), "..", "..", "..")
	shapes, err := loadDiscordShapes(root)
	if err != nil {
		t.Fatal(err)
	}
	if len(shapes) == 0 {
		t.Fatalf("%v hold no shapes", discordShapesPaths)
	}
	sources, err := collectCompatReferences(root)
	if err != nil {
		t.Fatal(err)
	}
	used := map[string]bool{}
	for _, reference := range sources.sorted() {
		if reference.Kind == referenceJavaShape {
			if _, ok := shapes[reference.Name]; !ok {
				t.Errorf("%s:%d names the unknown shape %q", reference.Locations[0].File, reference.Locations[0].Line, reference.Name)
			}
			used[reference.Name] = true
		}
	}
	for name := range shapes {
		if !used[name] {
			t.Errorf("no code looks up the shape %q", name)
		}
	}
}

func TestDiscordShapeValidation(t *testing.T) {
	for _, shape := range []discordShape{
		{Owner: "a.B", Member: "property", Pick: shapePickOnly},
		{Owner: "a.B", Member: shapeField, Pick: "first"},
		{Member: shapeField, Pick: shapePickOnly},
		{Owner: "a.B", Member: shapeField, Pick: shapePickAll},
		{Owner: "a.B", Member: shapeField, Count: intPointer(2), Pick: shapePickOnly},
		{Owner: "a.B", OwnerShape: "c", Member: shapeField, Pick: shapePickOnly},
		{OwnerShape: "c", ParameterOf: "a.B", Member: shapeField, Pick: shapePickOnly},
		{Owner: "a.B", Member: shapeMethod, TypeAssignableTo: "a.C", Pick: shapePickOnly},
		{Owner: "a.B", Member: shapeField, Type: "a.C", TypeAssignableTo: "a.C", Pick: shapePickOnly},
		{Owner: "a.B", Member: shapeField, ReturnsAssignableFrom: "a.C", Pick: shapePickOnly},
	} {
		if shape.validate() == nil {
			t.Errorf("shape %+v must not validate", shape)
		}
	}
	for _, shapes := range []map[string]discordShape{
		{"field": {OwnerShape: "missing", Member: shapeField, Pick: shapePickOnly}},
		{
			"first":  {OwnerShape: "second", Member: shapeField, Pick: shapePickOnly},
			"second": {OwnerShape: "third", Member: shapeField, Pick: shapePickOnly},
			"third":  {Owner: "a.B", Member: shapeConstructor, Pick: shapePickOnly},
		},
	} {
		if validateDiscordShapes(shapes) == nil {
			t.Errorf("shapes %+v must not validate", shapes)
		}
	}
	valid := map[string]discordShape{
		"surface": {ParameterOf: "a.B", Member: shapeConstructor, Pick: shapePickOnly},
		"handler": {OwnerShape: "surface", Member: shapeField, Count: intPointer(2), Pick: shapePickAll},
	}
	if err := validateDiscordShapes(valid); err != nil {
		t.Errorf("an owner shape that names its class directly must validate: %v", err)
	}
}

func TestEvaluateStructuralShapes(t *testing.T) {
	surfaceParameters := []string{"android.content.Context", "java.lang.String", "android.os.Bundle"}
	shapes := map[string]discordShape{
		"surface":    {ParameterOf: "com.facebook.ReactInstance", UnlessClass: "com.facebook.ReactHost", Member: shapeConstructor, Parameters: surfaceParameters, Pick: shapePickOnly},
		"handler":    {OwnerShape: "surface", Member: shapeField, Type: "com.facebook.SurfaceHandler", Pick: shapePickOnly},
		"references": {OwnerShape: "surface", Member: shapeField, Type: "java.util.concurrent.atomic.AtomicReference", Count: intPointer(2), Pick: shapePickAll},
		"host":       {OwnerShape: "surface", Member: shapeMethod, ParameterCount: intPointer(0), ReturnsAssignableFrom: "com.facebook.ReactHostImpl", Pick: shapePickOnly},
		"factory":    {Owner: "com.facebook.Delegate", Member: shapeField, TypeAssignableTo: "kotlin.jvm.functions.Function2", Pick: shapePickOnly},
	}
	instance := &dexClass{Name: "com.facebook.ReactInstance", Declared: []dexMember{
		{Name: "g", Returns: "void", Parameters: []string{"um.a0"}},
		{Name: "d", Returns: "java.lang.Object", Parameters: []string{"java.lang.String"}},
		{Name: "h", Returns: "void", Parameters: []string{"um.b", "int"}},
	}}
	surface := &dexClass{Name: "um.a0", Constructors: [][]string{surfaceParameters}, Declared: []dexMember{
		{Name: "a", Field: true, Type: "com.facebook.SurfaceHandler"},
		{Name: "c", Field: true, Type: "java.util.concurrent.atomic.AtomicReference"},
		{Name: "d", Field: true, Type: "java.util.concurrent.atomic.AtomicReference"},
		{Name: "a", Returns: "com.facebook.ReactHostImpl", Parameters: []string{}},
		{Name: "b", Returns: "java.lang.Object", Parameters: []string{}},
	}}
	unrelated := &dexClass{Name: "um.b", Constructors: [][]string{surfaceParameters}}
	hostImpl := &dexClass{Name: "com.facebook.ReactHostImpl", Super: javaObjectClass}
	factory := &dexClass{Name: "af.e", Super: javaObjectClass, Interfaces: []string{"kotlin.jvm.functions.Function2"}}
	merged := &dexClass{Name: "q4.e", Super: javaObjectClass, Interfaces: []string{"m50.i"}}
	mergedInterface := &dexClass{Name: "m50.i"}
	delegate := &dexClass{Name: "com.facebook.Delegate", Declared: []dexMember{
		{Name: "d", Field: true, Type: "kotlin.jvm.functions.Function1"},
		{Name: "e", Field: true, Type: "q4.e"},
		{Name: "f", Field: true, Type: "af.e"},
	}}
	classes := []*dexClass{instance, surface, unrelated, hostImpl, factory, merged, mergedInterface, delegate}

	expect := func(target *compatTarget, name, status, reason string) {
		t.Helper()
		got, why := evaluateShapeReference(&compatReference{Kind: referenceJavaShape, Name: name}, target)
		if got != status || !strings.Contains(why, reason) {
			t.Fatalf("shape %s: got %q (%s), want %q containing %q", name, got, why, status, reason)
		}
	}

	matching := shapeTestTarget(shapes, classes...)
	for _, name := range []string{"surface", "handler", "references", "host", "factory"} {
		expect(matching, name, compatOK, "")
	}

	ambiguousSurface := &dexClass{Name: instance.Name, Declared: append(slices.Clone(instance.Declared), dexMember{Name: "i", Returns: "void", Parameters: []string{"um.b"}})}
	ambiguous := shapeTestTarget(shapes, ambiguousSurface, surface, unrelated, hostImpl)
	expect(ambiguous, "surface", compatBroken, "several classes taken alone by a `com.facebook.ReactInstance` method have one constructor")
	expect(ambiguous, "handler", compatBroken, "it looks in the class the shape `surface` finds, but several classes")

	expect(shapeTestTarget(shapes, surface), "surface", compatBroken, "class `com.facebook.ReactInstance` is not in Discord's dex")

	threeReferences := &dexClass{Name: surface.Name, Constructors: surface.Constructors, Declared: append(slices.Clone(surface.Declared), dexMember{Name: "e", Field: true, Type: "java.util.concurrent.atomic.AtomicReference"})}
	expect(shapeTestTarget(shapes, instance, threeReferences, hostImpl), "references", compatBroken, "has 3 fields of type `java.util.concurrent.atomic.AtomicReference`, `c`, `d`, `e`, not 2")

	objectGetter := &dexClass{Name: surface.Name, Constructors: surface.Constructors, Declared: []dexMember{{Name: "a", Returns: javaObjectClass, Parameters: []string{}}}}
	expect(shapeTestTarget(shapes, instance, objectGetter, hostImpl), "host", compatBroken, "`um.a0` has no method returning `com.facebook.ReactHostImpl` or a supertype other than `java.lang.Object` with 0 parameters")

	interfaceGetter := &dexClass{Name: surface.Name, Constructors: surface.Constructors, Declared: []dexMember{{Name: "a", Returns: "com.facebook.ReactHost", Parameters: []string{}}}}
	hostWithInterface := &dexClass{Name: hostImpl.Name, Super: javaObjectClass, Interfaces: []string{"com.facebook.ReactHost"}}
	expect(shapeTestTarget(shapes, instance, interfaceGetter, hostWithInterface), "host", compatOK, "")

	mergedFactory := &dexClass{Name: merged.Name, Super: javaObjectClass, Interfaces: []string{"m50.i"}}
	functionInterface := &dexClass{Name: "m50.i", Interfaces: []string{"kotlin.jvm.functions.Function2"}}
	expect(shapeTestTarget(shapes, delegate, factory, mergedFactory, functionInterface), "factory", compatBroken, "`e`, `f`, so the lookup is ambiguous")

	legacy := shapeTestTarget(shapes, &dexClass{Name: "com.facebook.ReactHost"})
	expect(legacy, "surface", compatFallback, "Discord still has `com.facebook.ReactHost`, so the loader does not need this shape")
	expect(legacy, "handler", compatBroken, "it looks in the class the shape `surface` finds")

	results := evaluateCompat([]*compatReference{{
		Kind:      referenceJavaShape,
		Name:      "surface",
		Component: "loader-android",
		Locations: []compatLocation{{File: "packages/loader/android/module/src/main/kotlin/app/unbound/android/ReactSurfaces.kt", Line: 48}},
	}}, []*compatTarget{legacy}, nil)
	if compatBreakageError(results) != nil {
		t.Fatal("a shape Discord does not need yet must not fail the release gate")
	}
	if report := renderCompatReport(results); !strings.Contains(report, "only unused while Discord still has the class") || !strings.Contains(report, "ReactSurfaces.kt:48") {
		t.Fatalf("the report must explain why a shape is skipped and where it is used:\n%s", report)
	}
}

func TestKotlinShapeExtraction(t *testing.T) {
	source := `package app.unbound.android

object ReactSurfaces {
    fun pieces(shapes: DiscordShapes) = listOf(
        shapes.shapeClass("reactSurface"),
        shapes.shapeField(
            "reactFabric",
        ),
        shapes.shapeFields("reactSurfaceReferences"),
        shapes.shapeMethod("reactSurfaceHost"),
    )

    fun shapeField(name: String) = name
}
`
	set := newCompatSourceSet()
	file := compatSourceFile{path: "packages/loader/android/module/src/main/kotlin/app/unbound/android/ReactSurfaces.kt", component: "loader-android", platform: "android"}
	extractNativeReferences(set, file, source)

	lines := map[string]int{}
	for _, reference := range set.sorted() {
		if reference.Kind == referenceJavaShape {
			lines[reference.Name] = reference.Locations[0].Line
		}
	}
	want := map[string]int{"reactSurface": 5, "reactFabric": 7, "reactSurfaceReferences": 9, "reactSurfaceHost": 10}
	if !reflect.DeepEqual(lines, want) {
		t.Fatalf("Kotlin shape lookups must be reported at the line naming the shape: got %v, want %v", lines, want)
	}
	for _, reference := range set.sorted() {
		if reference.Kind == referenceJavaShape && (reference.Component != "loader-android" || reference.platforms()[0] != "android") {
			t.Fatalf("a Kotlin shape belongs to the Android loader: %+v", reference)
		}
	}
}

func TestDexAssignability(t *testing.T) {
	dex := newDexIndex()
	for _, class := range []*dexClass{
		{Name: "a.Child", Super: "a.Parent", Interfaces: []string{"a.Marker"}},
		{Name: "a.Parent", Super: javaObjectClass},
		{Name: "a.Marker", Interfaces: []string{"kotlin.Function"}},
		{Name: "a.Loop", Super: "a.Loop"},
	} {
		dex.Classes[class.Name] = class
	}
	for _, test := range []struct {
		from, to string
		want     bool
	}{
		{"a.Child", "a.Child", true},
		{"a.Child", "a.Parent", true},
		{"a.Child", javaObjectClass, true},
		{"a.Child", "kotlin.Function", true},
		{"a.Parent", "a.Child", false},
		{"a.Loop", "a.Parent", false},
		{"java.lang.String", "a.Parent", false},
	} {
		if got := dex.isAssignable(test.from, test.to); got != test.want {
			t.Errorf("isAssignable(%s, %s) = %v, want %v", test.from, test.to, got, test.want)
		}
	}
}
