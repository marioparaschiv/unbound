package main

import (
	"path"
	"sort"
	"strconv"
	"strings"
)

type scriptValueKind uint8

const (
	valueDynamic scriptValueKind = iota
	valueString
	valueArray
	valueObject
	valueLiteral
	valueParam
	valueOpaque
)

const (
	scriptRowLimit   = 64
	scriptDepthLimit = 10
	scriptPassLimit  = 16
)

type scriptParamRef struct {
	function *scriptFunction
	index    int
	element  bool
	path     []int
}

type scriptValue struct {
	kind    scriptValueKind
	texts   []string
	runtime bool
	partial bool
	items   []scriptValue
	fields  map[string]scriptValue
	literal string
	param   *scriptParamRef
	spread  bool
}

func dynamicValue() scriptValue { return scriptValue{kind: valueDynamic} }

func opaqueValue() scriptValue { return scriptValue{kind: valueOpaque} }

func literalValue(text string) scriptValue { return scriptValue{kind: valueLiteral, literal: text} }

func textValue(texts ...string) scriptValue { return scriptValue{kind: valueString, texts: texts} }

func paramValue(reference scriptParamRef) scriptValue {
	return scriptValue{kind: valueParam, param: &reference}
}

func unionValues(values ...scriptValue) scriptValue {
	var result scriptValue
	seen := map[string]bool{}
	hasText, hasArray, dynamic := false, false, false
	var items []scriptValue
	var literal *scriptValue
	for _, value := range values {
		switch value.kind {
		case valueParam:
			return value
		case valueString:
			hasText = true
			result.runtime = result.runtime || value.runtime
			result.partial = result.partial || value.partial
			for _, text := range value.texts {
				if !seen[text] {
					seen[text] = true
					result.texts = append(result.texts, text)
				}
			}
		case valueArray:
			hasArray = true
			items = append(items, value.items...)
		case valueDynamic:
			dynamic = true
		case valueLiteral, valueOpaque, valueObject:
			if literal == nil {
				copied := value
				literal = &copied
			}
		}
	}
	switch {
	case hasText:
		result.kind = valueString
		result.partial = result.partial || dynamic || hasArray
		return result
	case hasArray && !dynamic:
		return scriptValue{kind: valueArray, items: items}
	case dynamic:
		return dynamicValue()
	case literal != nil:
		return *literal
	}
	return literalValue("undefined")
}

func scriptValueKey(value scriptValue) string {
	var builder strings.Builder
	writeScriptValueKey(&builder, value)
	return builder.String()
}

func writeScriptValueKey(builder *strings.Builder, value scriptValue) {
	if value.spread {
		builder.WriteString("...")
	}
	switch value.kind {
	case valueDynamic:
		builder.WriteString("?")
	case valueOpaque:
		builder.WriteString("#")
	case valueLiteral:
		builder.WriteString("l:" + value.literal)
	case valueString:
		builder.WriteString("s:" + strconv.Quote(strings.Join(value.texts, "\x00")))
		if value.runtime {
			builder.WriteString("+r")
		}
		if value.partial {
			builder.WriteString("+?")
		}
	case valueParam:
		reference := value.param
		builder.WriteString("p:" + reference.function.file.source.path + ":" + strconv.Itoa(reference.function.index) + ":" + strconv.Itoa(reference.index))
		if reference.element {
			builder.WriteString("e")
		}
		for _, step := range reference.path {
			builder.WriteString("." + strconv.Itoa(step))
		}
	case valueArray:
		builder.WriteString("[")
		for _, item := range value.items {
			writeScriptValueKey(builder, item)
			builder.WriteString(",")
		}
		builder.WriteString("]")
	case valueObject:
		keys := make([]string, 0, len(value.fields))
		for key := range value.fields {
			keys = append(keys, key)
		}
		sort.Strings(keys)
		builder.WriteString("{")
		for _, key := range keys {
			builder.WriteString(key + ":")
			writeScriptValueKey(builder, value.fields[key])
			builder.WriteString(",")
		}
		builder.WriteString("}")
	}
}

func firstParam(value scriptValue) *scriptParamRef {
	switch value.kind {
	case valueParam:
		return value.param
	case valueArray:
		for _, item := range value.items {
			if reference := firstParam(item); reference != nil {
				return reference
			}
		}
	}
	return nil
}

func elementOf(value scriptValue) []scriptValue {
	switch value.kind {
	case valueArray:
		if len(value.items) > scriptRowLimit {
			return value.items[:scriptRowLimit]
		}
		return value.items
	case valueString:
		var rows []scriptValue
		for _, text := range value.texts {
			rows = append(rows, textValue(text))
		}
		if value.partial || value.runtime && len(value.texts) == 0 {
			rows = append(rows, scriptValue{kind: valueString, runtime: value.runtime, partial: value.partial})
		}
		return rows
	case valueParam:
		reference := *value.param
		reference.element = true
		return []scriptValue{paramValue(reference)}
	case valueLiteral, valueOpaque, valueObject:
		return nil
	}
	return []scriptValue{dynamicValue()}
}

func applyIndex(value scriptValue, index int) scriptValue {
	switch value.kind {
	case valueArray:
		if index >= 0 && index < len(value.items) {
			return value.items[index]
		}
		return literalValue("undefined")
	case valueParam:
		reference := *value.param
		if !reference.element {
			reference.element = true
		} else if len(reference.path) < 2 {
			reference.path = append(append([]int{}, reference.path...), index)
		}
		return paramValue(reference)
	case valueString:
		return value
	case valueLiteral, valueOpaque:
		return literalValue("undefined")
	}
	return dynamicValue()
}

func applyPath(value scriptValue, steps []scriptPathStep) scriptValue {
	for _, step := range steps {
		switch {
		case step.key != "":
			switch value.kind {
			case valueObject:
				field, ok := value.fields[step.key]
				if !ok {
					field = dynamicValue()
				}
				value = field
			case valueLiteral, valueOpaque:
				value = opaqueValue()
			default:
				value = dynamicValue()
			}
		case step.restFrom >= 0:
			switch value.kind {
			case valueArray:
				if step.restFrom < len(value.items) {
					value = scriptValue{kind: valueArray, items: value.items[step.restFrom:]}
				} else {
					value = scriptValue{kind: valueArray}
				}
			case valueParam:
			default:
				value = dynamicValue()
			}
		default:
			value = applyIndex(value, step.index)
		}
	}
	return value
}

func memberOf(value scriptValue, name string) scriptValue {
	switch value.kind {
	case valueObject:
		if field, ok := value.fields[name]; ok {
			return field
		}
		return dynamicValue()
	case valueArray:
		if name == "length" {
			return literalValue("number")
		}
		return opaqueValue()
	case valueString:
		if name == "length" {
			return literalValue("number")
		}
	case valueLiteral, valueOpaque:
		return opaqueValue()
	}
	return dynamicValue()
}

type scriptTemplate struct {
	sink     string
	method   string
	args     []scriptValue
	location compatLocation
}

type scriptReceiver struct {
	bridge  string
	factory *scriptFunction
}

type scriptSite struct {
	file     *scriptFile
	position int
	call     string
}

func (site scriptSite) location() compatLocation {
	return compatLocation{File: site.file.source.path, Line: site.file.tokens[site.position].line}
}

type scriptContext struct {
	file     *scriptFile
	function int
	env      map[string]scriptValue
	depth    int
	position int
}

type scriptCallTarget struct {
	sink     string
	function *scriptFunction
}

type scriptProgram struct {
	files         map[string]*scriptFile
	ordered       []*scriptFile
	components    map[string][]*scriptFile
	templates     map[*scriptFunction]map[string]scriptTemplate
	instantiated  map[*scriptFunction]bool
	changed       bool
	emit          bool
	set           *compatSourceSet
	memo          map[string]scriptValue
	evaluating    map[string]bool
	receiverCache map[string][]scriptReceiver
	memberCache   map[*scriptFunction]map[string]*scriptFunction
	returnCache   map[*scriptFunction][]int
	dynamicSeen   map[string]bool
}

var scriptBridgeTypes = map[string]string{
	"NativeObjCBridge": "objc", "NativeJavaBridge": "java", "NativeJavaHooksBridge": "hooks",
}

var scriptSinkRoles = map[string][]int{
	"objc.getClass": {0}, "objc.alloc": {0}, "objc.findViews": {1}, "objc.hook": {0, 1},
	"objc.invoke": {1}, "objc.invokeAsync": {1}, "objc.call": {1}, "objc.callAsync": {1}, "objc.respondsTo": {1},
	"objc.callSuper": {1, 2}, "objc.invokeSuper": {1, 2}, "objc.invokeSuperAsync": {1, 2},
	"objc.getIvar": {1}, "objc.setIvar": {1}, "objc.batchStep": {0},
	"java.getClass": {0}, "java.construct": {0}, "java.invoke": {1}, "java.invokeAsync": {1}, "java.respondsTo": {1},
	"java.getField": {1}, "java.setField": {1}, "hooks.hook": {0, 1, 2},
}

func newScriptProgram(files []*scriptFile) *scriptProgram {
	program := &scriptProgram{
		files:         map[string]*scriptFile{},
		components:    map[string][]*scriptFile{},
		templates:     map[*scriptFunction]map[string]scriptTemplate{},
		instantiated:  map[*scriptFunction]bool{},
		receiverCache: map[string][]scriptReceiver{},
		memberCache:   map[*scriptFunction]map[string]*scriptFunction{},
		returnCache:   map[*scriptFunction][]int{},
		dynamicSeen:   map[string]bool{},
	}
	for _, file := range files {
		program.files[file.source.path] = file
		program.ordered = append(program.ordered, file)
		program.components[file.source.component] = append(program.components[file.source.component], file)
	}
	return program
}

func analyzeScripts(set *compatSourceSet, files []*scriptFile) {
	program := newScriptProgram(files)
	for pass := 0; pass < scriptPassLimit; pass++ {
		program.changed = false
		program.run()
		if !program.changed {
			break
		}
	}
	program.emit = true
	program.set = set
	program.instantiated = map[*scriptFunction]bool{}
	program.run()
	program.reportUncalledForwarders()
}

func (program *scriptProgram) run() {
	program.memo = map[string]scriptValue{}
	program.evaluating = map[string]bool{}
	for _, file := range program.ordered {
		for index := range file.tokens {
			if program.emit && file.tokens[index].kind == tokenString {
				program.classifyString(file, index)
			}
			program.scanCall(file, index)
			program.scanBatchStep(file, index)
		}
	}
}

func (program *scriptProgram) classifyString(file *scriptFile, index int) {
	token := file.tokens[index]
	previous := file.value(index - 1)
	if previous == "from" || previous == "import" || (previous == "(" && file.value(index-2) == "import") || (index > 0 && file.statements[index]) {
		return
	}
	reference := compatReference{Component: file.source.component, Platform: file.source.platform}
	switch {
	case javaClassPattern.MatchString(token.value):
		reference.Kind, reference.Name = referenceJavaClass, token.value
	case modulePathPattern.MatchString(token.value):
		reference.Kind, reference.Name = referenceModulePath, token.value
	case discordObjCClassRegex.MatchString(token.value):
		reference.Kind, reference.Name = referenceObjCClass, token.value
	default:
		return
	}
	program.set.add(reference, compatLocation{File: file.source.path, Line: token.line})
}

func (program *scriptProgram) scanCall(file *scriptFile, index int) {
	if !file.isIdentifier(index) || file.definitions[index] || scriptKeywords[file.value(index)] {
		return
	}
	open := index + 1
	if file.isPunctuation(open, "<") {
		if after := file.skipGenerics(open); after != open && file.isPunctuation(after, "(") {
			open = after
		}
	}
	if !file.isPunctuation(open, "(") || file.match[open] < 0 {
		return
	}
	if previous := file.value(index - 1); previous == "function" || previous == "new" {
		return
	}
	name := file.value(index)
	owner := ""
	if file.isPunctuation(index-1, ".") {
		position := index - 2
		if file.isPunctuation(position, "?") {
			position--
		}
		owner = "."
		if file.isIdentifier(position) {
			owner = file.value(position)
		}
	}
	targets := program.callTargets(file, index, owner, name)
	if len(targets) == 0 {
		if program.emit && owner != "" && owner != "." {
			program.reportUnknownReceiver(file, index, open, owner, name)
		}
		return
	}
	call := name
	if owner != "" && owner != "." {
		call = owner + "." + name
	}
	site := scriptSite{file: file, position: index, call: call}
	for _, env := range program.environments(file, index) {
		context := &scriptContext{file: file, function: file.scope[index], env: env, position: index}
		args := program.evalArgs(context, open)
		for _, target := range targets {
			if target.function != nil {
				program.applyForwarder(site, target.function, args)
			} else {
				program.applySink(site, target.sink, name, args)
			}
		}
	}
}

func (program *scriptProgram) callTargets(file *scriptFile, index int, owner, name string) []scriptCallTarget {
	var targets []scriptCallTarget
	addSink := func(bridge string) {
		sink := bridge + "." + name
		if _, ok := scriptSinkRoles[sink]; ok {
			targets = append(targets, scriptCallTarget{sink: sink})
		}
	}
	switch owner {
	case "objc", "java", "hooks":
		addSink(owner)
		return targets
	case "", ".":
	default:
		for _, receiver := range program.receivers(file, owner) {
			if receiver.bridge != "" {
				addSink(receiver.bridge)
			} else if member := program.factoryMember(receiver.factory, name); member != nil {
				targets = append(targets, scriptCallTarget{function: member})
			}
		}
		if imported, ok := file.imports[owner]; ok && (imported.imported == "*" || imported.imported == "default") {
			if module := program.resolveModule(file, imported.module); module != nil {
				if function := program.exportedFunction(module, name, 0); function != nil {
					targets = append(targets, scriptCallTarget{function: function})
				}
			}
		}
	}
	if _, ok := scriptLookupCalls[name]; ok && len(targets) == 0 {
		return []scriptCallTarget{{sink: "metro"}}
	}
	if owner == "" {
		if function := program.resolveFunction(file, file.scope[index], name); function != nil {
			targets = append(targets, scriptCallTarget{function: function})
		}
	}
	return targets
}

func (program *scriptProgram) reportUnknownReceiver(file *scriptFile, index, open int, owner, name string) {
	roles, ok := scriptSinkRoles["objc."+name]
	if !ok {
		roles, ok = scriptSinkRoles["java."+name]
	}
	if !ok {
		return
	}
	context := &scriptContext{file: file, function: file.scope[index], env: map[string]scriptValue{}, position: index}
	parts := file.splitTopLevel(open+1, file.match[open], ",")
	for _, role := range roles {
		if role >= len(parts) || parts[role][1]-parts[role][0] != 1 {
			continue
		}
		if value := program.eval(context, parts[role][0], parts[role][1]); value.kind == valueString && len(value.texts) > 0 {
			program.dynamic(scriptSite{file: file, position: index, call: owner + "." + name + " (unknown bridge)"})
			return
		}
	}
}

func (program *scriptProgram) scanBatchStep(file *scriptFile, index int) {
	if !file.isPunctuation(index, "{") || file.match[index] < 0 {
		return
	}
	switch file.value(index - 1) {
	case "(", "[", ",", ":", "=", "return", "?", ">":
	default:
		return
	}
	if file.isPunctuation(index-1, ">") && file.isArrow(index-2) {
		return
	}
	close := file.match[index]
	var target, selector [2]int
	for _, part := range file.splitTopLevel(index+1, close, ",") {
		if !file.isIdentifier(part[0]) {
			continue
		}
		switch file.value(part[0]) {
		case "target":
			target = part
		case "selector":
			selector = part
		}
	}
	if target[1] == 0 || selector[1] == 0 {
		return
	}
	site := scriptSite{file: file, position: selector[0], call: "objc.batch"}
	for _, env := range program.environments(file, selector[0]) {
		context := &scriptContext{file: file, function: file.scope[selector[0]], env: env, position: selector[0]}
		var value scriptValue
		if selector[1]-selector[0] == 1 {
			value = program.resolveIdentifier(context, "selector")
		} else if file.isPunctuation(selector[0]+1, ":") {
			value = program.eval(context, selector[0]+2, selector[1])
		} else {
			continue
		}
		program.applySink(site, "objc.batchStep", "batch", []scriptValue{value})
	}
}

func (program *scriptProgram) environments(file *scriptFile, position int) []map[string]scriptValue {
	var active []*scriptBinding
	for _, binding := range file.bindings {
		if binding.start <= position && position < binding.end {
			active = append(active, binding)
		}
	}
	sort.SliceStable(active, func(left, right int) bool { return active[left].start < active[right].start })
	envs := []map[string]scriptValue{{}}
	for _, binding := range active {
		var next []map[string]scriptValue
		for _, env := range envs {
			context := &scriptContext{file: file, function: binding.function, env: env, position: binding.sourceStart}
			source := program.eval(context, binding.sourceStart, binding.sourceEnd)
			rows := elementOf(source)
			if len(rows) == 0 {
				rows = []scriptValue{dynamicValue()}
			}
			for _, row := range rows {
				if len(next) >= scriptRowLimit {
					break
				}
				extended := make(map[string]scriptValue, len(env)+len(binding.pattern))
				for key, value := range env {
					extended[key] = value
				}
				for _, name := range binding.pattern {
					extended[name.name] = applyPath(row, name.path)
				}
				next = append(next, extended)
			}
		}
		envs = next
	}
	return envs
}

func (program *scriptProgram) sinkRoles(sink string, args []scriptValue) []int {
	if sink == "metro" {
		roles := make([]int, len(args))
		for index := range args {
			roles[index] = index
		}
		return roles
	}
	return scriptSinkRoles[sink]
}

func (program *scriptProgram) applySink(site scriptSite, sink, method string, args []scriptValue) {
	roles := program.sinkRoles(sink, args)
	for _, role := range roles {
		if role >= len(args) {
			continue
		}
		if reference := firstParam(args[role]); reference != nil {
			program.registerTemplate(site, reference.function, sink, method, args, roles)
			return
		}
	}
	if !program.emit {
		return
	}
	program.emitSink(site, sink, method, args)
}

func (program *scriptProgram) registerTemplate(site scriptSite, function *scriptFunction, sink, method string, args []scriptValue, roles []int) {
	if function.kind == functionAnonymous || function.kind == functionProperty || function.name == "" {
		if program.emit {
			program.dynamic(site)
		}
		return
	}
	normalized := make([]scriptValue, len(args))
	for index := range normalized {
		normalized[index] = dynamicValue()
	}
	for _, role := range roles {
		if role < len(args) {
			normalized[role] = args[role]
		}
	}
	if sink == "metro" {
		copy(normalized, args)
	}
	key := sink + "|" + method
	for _, value := range normalized {
		key += "|" + scriptValueKey(value)
	}
	if program.templates[function] == nil {
		program.templates[function] = map[string]scriptTemplate{}
	}
	if _, exists := program.templates[function][key]; exists {
		return
	}
	if len(program.templates[function]) >= scriptRowLimit {
		return
	}
	program.templates[function][key] = scriptTemplate{sink: sink, method: method, args: normalized, location: site.location()}
	program.changed = true
}

func (program *scriptProgram) applyForwarder(site scriptSite, function *scriptFunction, args []scriptValue) {
	templates := program.templates[function]
	if len(templates) == 0 {
		return
	}
	program.instantiated[function] = true
	keys := make([]string, 0, len(templates))
	for key := range templates {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	forwarded := site
	if function.name != "" {
		forwarded.call = site.call
	}
	for _, key := range keys {
		template := templates[key]
		for _, substituted := range program.substitute(template.args, function, args) {
			program.applySink(forwarded, template.sink, template.method, substituted)
		}
	}
}

func (program *scriptProgram) parameterValues(function *scriptFunction, args []scriptValue) []scriptValue {
	values := make([]scriptValue, len(function.params))
	spreadAt := -1
	for index, arg := range args {
		if arg.spread {
			spreadAt = index
			break
		}
	}
	for index, param := range function.params {
		switch {
		case spreadAt >= 0 && index >= spreadAt:
			spread := args[spreadAt]
			if param.rest && index == spreadAt && spread.kind == valueParam {
				plain := spread
				plain.spread = false
				values[index] = plain
			} else {
				values[index] = dynamicValue()
			}
		case param.rest:
			var items []scriptValue
			if index < len(args) {
				items = append(items, args[index:]...)
			}
			values[index] = scriptValue{kind: valueArray, items: items}
		case index < len(args):
			values[index] = args[index]
		default:
			values[index] = literalValue("undefined")
		}
	}
	return values
}

func (program *scriptProgram) substitute(templateArgs []scriptValue, function *scriptFunction, args []scriptValue) [][]scriptValue {
	values := program.parameterValues(function, args)
	groups := map[int]bool{}
	var collect func(value scriptValue)
	collect = func(value scriptValue) {
		switch value.kind {
		case valueParam:
			if value.param.function == function && value.param.element {
				groups[value.param.index] = true
			}
		case valueArray:
			for _, item := range value.items {
				collect(item)
			}
		}
	}
	for _, value := range templateArgs {
		collect(value)
	}
	indices := make([]int, 0, len(groups))
	for index := range groups {
		indices = append(indices, index)
	}
	sort.Ints(indices)
	rows := []map[int]scriptValue{{}}
	for _, index := range indices {
		var elements []scriptValue
		if index < len(values) {
			elements = elementOf(values[index])
		}
		if len(elements) == 0 {
			elements = []scriptValue{literalValue("undefined")}
		}
		var next []map[int]scriptValue
		for _, row := range rows {
			for _, element := range elements {
				if len(next) >= scriptRowLimit {
					break
				}
				extended := map[int]scriptValue{index: element}
				for key, value := range row {
					extended[key] = value
				}
				next = append(next, extended)
			}
		}
		rows = next
	}
	var results [][]scriptValue
	for _, row := range rows {
		var substituted []scriptValue
		for _, value := range templateArgs {
			if value.spread && value.kind == valueParam && value.param.function == function {
				base := program.substituteValue(value, function, values, row)
				switch base.kind {
				case valueArray:
					substituted = append(substituted, base.items...)
				case valueParam:
					base.spread = true
					substituted = append(substituted, base)
				default:
					spread := dynamicValue()
					spread.spread = true
					substituted = append(substituted, spread)
				}
				continue
			}
			substituted = append(substituted, program.substituteValue(value, function, values, row))
		}
		results = append(results, substituted)
	}
	return results
}

func (program *scriptProgram) substituteValue(value scriptValue, function *scriptFunction, values []scriptValue, row map[int]scriptValue) scriptValue {
	switch value.kind {
	case valueParam:
		reference := value.param
		if reference.function != function {
			return value
		}
		var base scriptValue
		switch {
		case reference.element:
			base = row[reference.index]
		case reference.index < len(values):
			base = values[reference.index]
		default:
			base = literalValue("undefined")
		}
		for _, step := range reference.path {
			base = applyIndex(base, step)
		}
		return base
	case valueArray:
		items := make([]scriptValue, len(value.items))
		for index, item := range value.items {
			items[index] = program.substituteValue(item, function, values, row)
		}
		return scriptValue{kind: valueArray, items: items}
	}
	return value
}

func (program *scriptProgram) dynamic(site scriptSite) {
	location := site.location()
	key := location.File + ":" + strconv.Itoa(location.Line) + ":" + site.call
	if program.dynamicSeen[key] {
		return
	}
	program.dynamicSeen[key] = true
	component := site.file.source.component
	program.set.dynamic[component]++
	program.set.dynamicSites = append(program.set.dynamicSites, compatDynamicSite{Component: component, Call: site.call, Location: location})
}

type scriptScalar struct {
	texts   []string
	runtime bool
	dynamic bool
}

func scalarOf(value scriptValue) scriptScalar {
	switch value.kind {
	case valueString:
		return scriptScalar{texts: value.texts, runtime: value.runtime, dynamic: value.partial}
	case valueArray:
		var result scriptScalar
		seen := map[string]bool{}
		for _, item := range value.items {
			inner := scalarOf(item)
			result.runtime = result.runtime || inner.runtime
			result.dynamic = result.dynamic || inner.dynamic
			for _, text := range inner.texts {
				if !seen[text] {
					seen[text] = true
					result.texts = append(result.texts, text)
				}
			}
		}
		return result
	case valueLiteral, valueOpaque, valueObject:
		return scriptScalar{}
	}
	return scriptScalar{dynamic: true}
}

func argumentAt(args []scriptValue, index int) scriptValue {
	for position, arg := range args {
		if arg.spread {
			return dynamicValue()
		}
		if position == index {
			return arg
		}
	}
	return literalValue("undefined")
}

func (program *scriptProgram) emitSink(site scriptSite, sink, method string, args []scriptValue) {
	file := site.file
	base := compatReference{Component: file.source.component, Platform: file.source.platform}
	base.Group, base.Alternative = file.fallbackAt(site.position)
	location := site.location()
	add := func(kind, class, name string, strict bool) {
		reference := base
		reference.Kind, reference.Class, reference.Name, reference.Strict = kind, class, name, strict
		program.set.add(reference, location)
	}
	single := func(index int, kind string, strict bool) {
		scalar := scalarOf(argumentAt(args, index))
		for _, text := range scalar.texts {
			add(kind, "", text, strict)
		}
		if scalar.dynamic {
			program.dynamic(site)
		}
	}
	paired := func(classIndex, nameIndex int, classKind, memberKind string) {
		classes := scalarOf(argumentAt(args, classIndex))
		names := scalarOf(argumentAt(args, nameIndex))
		if classes.dynamic || names.dynamic {
			program.dynamic(site)
		}
		for _, name := range names.texts {
			if len(classes.texts) == 0 && classes.runtime {
				add(memberKind, "", name, false)
			}
			for _, class := range classes.texts {
				reference := base
				reference.Kind, reference.Class, reference.Name = memberKind, class, name
				if memberKind == referenceJavaMethod {
					if parameters, ok := javaHookParameters(argumentAt(args, 2)); ok {
						reference.Parameters = parameters
					}
				}
				program.set.add(reference, location)
			}
		}
		for _, class := range classes.texts {
			add(classKind, "", class, true)
		}
	}
	switch sink {
	case "objc.getClass", "objc.alloc":
		single(0, referenceObjCClass, false)
	case "objc.findViews":
		single(1, referenceObjCClass, false)
	case "objc.hook":
		paired(0, 1, referenceObjCClass, referenceObjCMethod)
	case "objc.invoke", "objc.invokeAsync", "objc.call", "objc.callAsync", "objc.respondsTo", "objc.batchStep":
		single(sinkSelectorIndex(sink), referenceObjCMethod, false)
	case "objc.callSuper", "objc.invokeSuper", "objc.invokeSuperAsync":
		single(1, referenceObjCClass, false)
		single(2, referenceObjCMethod, false)
	case "objc.getIvar", "objc.setIvar":
		single(1, referenceObjCIvar, false)
	case "java.getClass", "java.construct":
		single(0, referenceJavaClass, false)
	case "java.invoke", "java.invokeAsync", "java.respondsTo":
		single(1, referenceJavaMethod, false)
	case "java.getField", "java.setField":
		single(1, referenceJavaField, false)
	case "hooks.hook":
		paired(0, 1, referenceJavaClass, referenceJavaMethod)
	case "metro":
		program.emitMetro(site, method, args, base, location)
	}
}

func sinkSelectorIndex(sink string) int {
	if sink == "objc.batchStep" {
		return 0
	}
	return 1
}

func javaHookParameters(value scriptValue) ([]string, bool) {
	if value.kind != valueArray {
		return nil, false
	}
	parameters := []string{}
	for _, item := range value.items {
		if item.kind != valueString || len(item.texts) != 1 || item.partial {
			return nil, false
		}
		parameters = append(parameters, item.texts[0])
	}
	return parameters, true
}

func (program *scriptProgram) emitMetro(site scriptSite, method string, args []scriptValue, base compatReference, location compatLocation) {
	kind := scriptLookupCalls[method]
	var positions [][]string
	dynamic := false
	for _, arg := range args {
		if arg.spread || arg.kind == valueDynamic {
			dynamic = len(positions) == 0
			break
		}
		if arg.kind != valueString {
			break
		}
		if arg.partial {
			dynamic = true
		}
		if len(arg.texts) == 0 {
			break
		}
		positions = append(positions, arg.texts)
	}
	if dynamic {
		program.dynamic(site)
	}
	if len(positions) == 0 {
		return
	}
	reference := base
	reference.Kind = kind
	switch kind {
	case referenceProps, referencePrototypes:
		for _, terms := range cartesianTexts(positions) {
			reference.Terms = terms
			program.set.add(reference, location)
		}
	case referenceStore:
		short := true
		for _, arg := range args {
			if arg.kind == valueObject {
				if option, ok := arg.fields["short"]; ok && option.kind == valueLiteral && option.literal == "false" {
					short = false
				}
				break
			}
		}
		if method == "byStore" && len(args) > 1 && args[1].kind == valueLiteral && args[1].literal == "false" {
			short = false
		}
		for _, name := range positions[0] {
			reference.Name = name
			if short {
				reference.Name += "Store"
			}
			program.set.add(reference, location)
		}
	default:
		for _, name := range positions[0] {
			reference.Name = name
			program.set.add(reference, location)
		}
	}
}

func cartesianTexts(positions [][]string) [][]string {
	results := [][]string{{}}
	for _, alternatives := range positions {
		var next [][]string
		for _, prefix := range results {
			for _, text := range alternatives {
				if len(next) >= 16 {
					break
				}
				next = append(next, append(append([]string{}, prefix...), text))
			}
		}
		results = next
	}
	return results
}

func (program *scriptProgram) evalArgs(context *scriptContext, open int) []scriptValue {
	file := context.file
	var args []scriptValue
	for _, part := range file.splitTopLevel(open+1, file.match[open], ",") {
		start := part[0]
		if file.isSpread(start) {
			value := program.eval(context, start+3, part[1])
			switch value.kind {
			case valueArray:
				args = append(args, value.items...)
			default:
				value.spread = true
				if value.kind != valueParam {
					value = dynamicValue()
					value.spread = true
				}
				args = append(args, value)
			}
			continue
		}
		args = append(args, program.eval(context, start, part[1]))
	}
	return args
}

func (program *scriptProgram) eval(context *scriptContext, start, end int) scriptValue {
	file := context.file
	if start >= end || context.depth > scriptDepthLimit {
		return dynamicValue()
	}
	end = program.stripTypeSuffix(file, start, end)
	if start >= end {
		return dynamicValue()
	}
	if function := file.functionAt[start]; function != nil && function.bodyEnd >= end-1 {
		return opaqueValue()
	}
	if question := program.findTernary(file, start, end); question > 0 {
		if colon := program.ternaryColon(file, question+1, end); colon > 0 {
			return unionValues(program.eval(context, question+1, colon), program.eval(context, colon+1, end))
		}
	}
	if parts := program.splitOperator(file, start, end, "?", "|"); len(parts) > 1 {
		var values []scriptValue
		for _, part := range parts {
			values = append(values, program.eval(context, part[0], part[1]))
		}
		return unionValues(values...)
	}
	if parts := program.splitOperator(file, start, end, "&"); len(parts) > 1 {
		last := parts[len(parts)-1]
		return program.eval(context, last[0], last[1])
	}
	return program.evalPostfix(context, start, end)
}

func (program *scriptProgram) stripTypeSuffix(file *scriptFile, start, end int) int {
	for position := start; position < end; position++ {
		if file.tokens[position].kind == tokenPunctuation && strings.Contains("([{", file.value(position)) && file.match[position] > position {
			position = file.match[position]
			continue
		}
		if position > start && file.isIdentifier(position) && (file.value(position) == "as" || file.value(position) == "satisfies") {
			return position
		}
	}
	for end > start && file.isPunctuation(end-1, "!") {
		end--
	}
	return end
}

func (program *scriptProgram) findTernary(file *scriptFile, start, end int) int {
	for position := start; position < end; position++ {
		if file.tokens[position].kind == tokenPunctuation && strings.Contains("([{", file.value(position)) && file.match[position] > position {
			position = file.match[position]
			continue
		}
		if file.isArrow(position) {
			return -1
		}
		if file.isPunctuation(position, "?") && !file.isPunctuation(position+1, ".") && !file.isPunctuation(position+1, "?") && !file.isPunctuation(position-1, "?") {
			return position
		}
	}
	return -1
}

func (program *scriptProgram) ternaryColon(file *scriptFile, start, end int) int {
	depth := 0
	for position := start; position < end; position++ {
		if file.tokens[position].kind == tokenPunctuation && strings.Contains("([{", file.value(position)) && file.match[position] > position {
			position = file.match[position]
			continue
		}
		switch {
		case file.isPunctuation(position, "?") && !file.isPunctuation(position+1, ".") && !file.isPunctuation(position+1, "?") && !file.isPunctuation(position-1, "?"):
			depth++
		case file.isPunctuation(position, ":"):
			if depth == 0 {
				return position
			}
			depth--
		}
	}
	return -1
}

func (program *scriptProgram) splitOperator(file *scriptFile, start, end int, operators ...string) [][2]int {
	var parts [][2]int
	begin := start
	for position := start; position+1 < end; position++ {
		if file.tokens[position].kind == tokenPunctuation && strings.Contains("([{", file.value(position)) && file.match[position] > position {
			position = file.match[position]
			continue
		}
		if file.isArrow(position) {
			return nil
		}
		for _, operator := range operators {
			if file.isPunctuation(position, operator) && file.isPunctuation(position+1, operator) && !file.isPunctuation(position+2, "=") && position > begin {
				parts = append(parts, [2]int{begin, position})
				begin = position + 2
				position++
				break
			}
		}
	}
	if len(parts) == 0 {
		return nil
	}
	return append(parts, [2]int{begin, end})
}

func (program *scriptProgram) evalPostfix(context *scriptContext, start, end int) scriptValue {
	file := context.file
	token := file.tokens[start]
	position := start
	var value scriptValue
	name := ""
	resolved := true
	switch {
	case token.kind == tokenString:
		value = textValue(token.value)
		position++
	case token.kind == tokenOther:
		if token.value == "/regex/" {
			value = opaqueValue()
		} else if strings.HasPrefix(token.value, "`") || strings.Contains(token.value, "${") {
			value = dynamicValue()
		} else {
			value = literalValue(token.value)
		}
		position++
	case token.kind == tokenIdentifier:
		switch token.value {
		case "true", "false", "null", "undefined":
			value = literalValue(token.value)
			position++
		case "await":
			return program.eval(context, start+1, end)
		case "typeof", "void", "delete":
			return dynamicValue()
		case "new", "function", "async", "class":
			return opaqueValue()
		default:
			name, resolved = token.value, false
			position++
		}
	case token.value == "(":
		close := file.match[start]
		if close < 0 {
			return dynamicValue()
		}
		value = program.eval(context, start+1, close)
		position = close + 1
	case token.value == "[":
		close := file.match[start]
		if close < 0 {
			return dynamicValue()
		}
		value = program.evalArray(context, start, close)
		position = close + 1
	case token.value == "{":
		close := file.match[start]
		if close < 0 {
			return dynamicValue()
		}
		value = program.evalObject(context, start, close)
		position = close + 1
	case token.value == "!" || token.value == "-" || token.value == "+" || token.value == "~":
		return literalValue("operator")
	default:
		return dynamicValue()
	}
	resolve := func() {
		if !resolved {
			value = program.resolveIdentifier(&scriptContext{file: file, function: context.function, env: context.env, depth: context.depth, position: start}, name)
			resolved = true
		}
	}
	lastName := name
	for position < end {
		switch {
		case file.isPunctuation(position, "!"):
			position++
		case file.isPunctuation(position, "?") && file.isPunctuation(position+1, "."):
			position++
		case file.isPunctuation(position, ".") && file.isIdentifier(position+1):
			member := file.value(position + 1)
			open := position + 2
			if file.isPunctuation(open, "<") {
				if after := file.skipGenerics(open); after != open && file.isPunctuation(after, "(") {
					open = after
				}
			}
			if file.isPunctuation(open, "(") && file.match[open] > open && file.match[open] < end {
				owner := lastName
				receiver := func() scriptValue {
					resolve()
					return value
				}
				value = program.evalMethod(context, receiver, owner, member, open)
				resolved = true
				lastName = ""
				position = file.match[open] + 1
				continue
			}
			resolve()
			value = memberOf(value, member)
			lastName = member
			position += 2
		case file.isPunctuation(position, "["):
			close := file.match[position]
			if close < 0 || close >= end {
				return dynamicValue()
			}
			resolve()
			index := program.eval(context, position+1, close)
			value = program.indexValue(value, index)
			lastName = ""
			position = close + 1
		case file.isPunctuation(position, "<") && !resolved:
			after := file.skipGenerics(position)
			if after == position || !file.isPunctuation(after, "(") {
				return dynamicValue()
			}
			position = after
		case file.isPunctuation(position, "("):
			close := file.match[position]
			if close < 0 || close >= end {
				return dynamicValue()
			}
			if !resolved {
				value = program.evalFunctionCall(context, name, position)
				resolved = true
			} else {
				value = dynamicValue()
			}
			lastName = ""
			position = close + 1
		default:
			return dynamicValue()
		}
	}
	resolve()
	return value
}

func (program *scriptProgram) indexValue(value, index scriptValue) scriptValue {
	if index.kind == valueLiteral {
		if number, err := strconv.Atoi(index.literal); err == nil {
			return applyIndex(value, number)
		}
	}
	if index.kind == valueString && value.kind == valueObject && len(index.texts) == 1 {
		return memberOf(value, index.texts[0])
	}
	switch value.kind {
	case valueArray:
		return unionValues(value.items...)
	case valueParam:
		return applyIndex(value, 0)
	case valueObject:
		var fields []scriptValue
		for _, field := range value.fields {
			fields = append(fields, field)
		}
		return unionValues(fields...)
	}
	return dynamicValue()
}

func (program *scriptProgram) evalArray(context *scriptContext, open, close int) scriptValue {
	file := context.file
	var items []scriptValue
	for _, part := range file.splitTopLevel(open+1, close, ",") {
		if file.isSpread(part[0]) {
			inner := program.eval(context, part[0]+3, part[1])
			switch inner.kind {
			case valueArray:
				items = append(items, inner.items...)
			case valueString:
				items = append(items, inner)
			default:
				return dynamicValue()
			}
			continue
		}
		items = append(items, program.eval(context, part[0], part[1]))
	}
	return scriptValue{kind: valueArray, items: items}
}

func (program *scriptProgram) evalObject(context *scriptContext, open, close int) scriptValue {
	file := context.file
	fields := map[string]scriptValue{}
	for _, part := range file.splitTopLevel(open+1, close, ",") {
		start := part[0]
		if file.isSpread(start) {
			inner := program.eval(context, start+3, part[1])
			for key, value := range inner.fields {
				fields[key] = value
			}
			continue
		}
		if !(file.isIdentifier(start) || file.tokens[start].kind == tokenString || file.tokens[start].kind == tokenOther) {
			continue
		}
		key := file.value(start)
		switch {
		case part[1]-start == 1 && file.isIdentifier(start):
			fields[key] = program.resolveIdentifier(&scriptContext{file: file, function: context.function, env: context.env, depth: context.depth + 1, position: start}, key)
		case file.isPunctuation(start+1, ":"):
			fields[key] = program.eval(context, start+2, part[1])
		default:
			fields[key] = opaqueValue()
		}
	}
	return scriptValue{kind: valueObject, fields: fields}
}

func (program *scriptProgram) evalMethod(context *scriptContext, receiver func() scriptValue, owner, method string, open int) scriptValue {
	file := context.file
	switch owner {
	case "objc", "java":
		if method == "className" {
			name := scriptValue{kind: valueString, runtime: true}
			if owner == "java" {
				return scriptValue{kind: valueObject, fields: map[string]scriptValue{"type": literalValue("string"), "value": name}}
			}
			return name
		}
		return opaqueValue()
	case "hooks", "metro", "filters", "Math", "JSON", "Promise", "Array", "Number", "Date", "console":
		return opaqueValue()
	case "Object":
		args := program.evalArgs(context, open)
		if len(args) == 0 {
			return dynamicValue()
		}
		switch method {
		case "entries", "keys", "values":
			if args[0].kind != valueObject {
				return dynamicValue()
			}
			keys := make([]string, 0, len(args[0].fields))
			for key := range args[0].fields {
				keys = append(keys, key)
			}
			sort.Strings(keys)
			var items []scriptValue
			for _, key := range keys {
				switch method {
				case "entries":
					items = append(items, scriptValue{kind: valueArray, items: []scriptValue{textValue(key), args[0].fields[key]}})
				case "keys":
					items = append(items, textValue(key))
				default:
					items = append(items, args[0].fields[key])
				}
			}
			return scriptValue{kind: valueArray, items: items}
		case "freeze":
			return args[0]
		}
		return opaqueValue()
	}
	if _, ok := scriptLookupCalls[method]; ok {
		return opaqueValue()
	}
	if owner != "" {
		if imported, ok := file.imports[owner]; ok && (imported.imported == "*" || imported.imported == "default") {
			if module := program.resolveModule(file, imported.module); module != nil {
				if function := program.exportedFunction(module, method, 0); function != nil {
					return program.returnValue(function, program.evalArgs(context, open), context.depth+1)
				}
			}
		}
	}
	value := receiver()
	callback := func() *scriptFunction {
		parts := file.splitTopLevel(open+1, file.match[open], ",")
		if len(parts) == 0 {
			return nil
		}
		start := parts[0][0]
		if function := file.functionAt[start]; function != nil {
			return function
		}
		if file.isIdentifier(start) && parts[0][1]-start == 1 {
			return program.resolveFunction(file, context.function, file.value(start))
		}
		return nil
	}
	switch value.kind {
	case valueArray:
		switch method {
		case "find", "findLast", "at", "pop", "shift":
			return unionValues(value.items...)
		case "filter", "slice", "sort", "toSorted", "reverse", "toReversed", "splice":
			return value
		case "flat":
			var items []scriptValue
			for _, item := range value.items {
				if item.kind == valueArray {
					items = append(items, item.items...)
				} else {
					items = append(items, item)
				}
			}
			return scriptValue{kind: valueArray, items: items}
		case "concat":
			items := append([]scriptValue{}, value.items...)
			for _, arg := range program.evalArgs(context, open) {
				if arg.kind == valueArray {
					items = append(items, arg.items...)
				} else {
					items = append(items, arg)
				}
			}
			return scriptValue{kind: valueArray, items: items}
		case "map", "flatMap":
			function := callback()
			if function == nil || len(value.items) > scriptRowLimit {
				return dynamicValue()
			}
			var items []scriptValue
			for _, item := range value.items {
				result := program.returnValueWith(function, []scriptValue{item}, context.env, context.depth+1)
				if method == "flatMap" && result.kind == valueArray {
					items = append(items, result.items...)
				} else {
					items = append(items, result)
				}
			}
			return scriptValue{kind: valueArray, items: items}
		case "includes", "some", "every", "indexOf", "findIndex", "join", "forEach", "lastIndexOf", "findLastIndex":
			return literalValue(method)
		}
	case valueString:
		switch method {
		case "find", "findLast", "at":
			return value
		case "filter", "slice":
			return scriptValue{kind: valueArray, items: elementOf(value)}
		}
		return literalValue(method)
	case valueParam:
		switch method {
		case "find", "findLast", "at", "pop", "shift":
			return applyIndex(value, 0)
		case "filter", "slice", "sort", "toSorted", "reverse", "toReversed":
			return value
		}
	case valueLiteral, valueOpaque:
		return opaqueValue()
	}
	return dynamicValue()
}

func (program *scriptProgram) evalFunctionCall(context *scriptContext, name string, open int) scriptValue {
	if _, ok := scriptLookupCalls[name]; ok {
		return opaqueValue()
	}
	switch name {
	case "require", "Symbol", "BigInt", "Boolean", "Number", "setTimeout", "setInterval", "requestAnimationFrame":
		return opaqueValue()
	case "String":
		return dynamicValue()
	}
	function := program.resolveFunction(context.file, context.function, name)
	if function == nil {
		return dynamicValue()
	}
	return program.returnValue(function, program.evalArgs(context, open), context.depth+1)
}

func (program *scriptProgram) returnValue(function *scriptFunction, args []scriptValue, depth int) scriptValue {
	return program.returnValueWith(function, args, nil, depth)
}

func (program *scriptProgram) returnValueWith(function *scriptFunction, args []scriptValue, outer map[string]scriptValue, depth int) scriptValue {
	if depth > scriptDepthLimit {
		return dynamicValue()
	}
	key := function.file.source.path + "#" + strconv.Itoa(function.index)
	for _, arg := range args {
		key += "|" + scriptValueKey(arg)
	}
	if len(outer) > 0 {
		names := make([]string, 0, len(outer))
		for name := range outer {
			names = append(names, name)
		}
		sort.Strings(names)
		for _, name := range names {
			key += "|" + name + "=" + scriptValueKey(outer[name])
		}
	}
	if value, ok := program.memo[key]; ok {
		return value
	}
	if program.evaluating[key] {
		return dynamicValue()
	}
	program.evaluating[key] = true
	defer delete(program.evaluating, key)

	env := map[string]scriptValue{}
	for name, value := range outer {
		env[name] = value
	}
	for index, value := range program.parameterValues(function, args) {
		param := function.params[index]
		if param.name != "" {
			env[param.name] = value
		}
		for _, name := range param.pattern {
			env[name.name] = applyPath(value, name.path)
		}
	}
	context := &scriptContext{file: function.file, function: function.index, env: env, depth: depth}
	var result scriptValue
	if !function.block {
		context.position = function.bodyStart
		result = program.eval(context, function.bodyStart, function.bodyEnd)
	} else {
		var values []scriptValue
		for _, position := range program.returns(function) {
			context.position = position
			values = append(values, program.eval(context, position+1, function.file.expressionEnd(position+1, function.bodyEnd)))
		}
		result = unionValues(values...)
	}
	program.memo[key] = result
	return result
}

func (program *scriptProgram) returns(function *scriptFunction) []int {
	if positions, ok := program.returnCache[function]; ok {
		return positions
	}
	var positions []int
	file := function.file
	for position := function.bodyStart; position < function.bodyEnd && position < len(file.tokens); position++ {
		if file.scope[position] == function.index && file.isIdentifier(position) && file.value(position) == "return" {
			positions = append(positions, position)
		}
	}
	program.returnCache[function] = positions
	return positions
}

func (file *scriptFile) parentOf(function int) int {
	if function < 0 {
		return -2
	}
	return file.functions[function].parent
}

func (file *scriptFile) findDeclaration(name string, function, position int) *scriptDeclaration {
	var chosen *scriptDeclaration
	for _, declaration := range file.declarations[name] {
		if declaration.function != function {
			continue
		}
		if chosen == nil || declaration.position <= position && declaration.position > chosen.position {
			chosen = declaration
		}
	}
	return chosen
}

func (program *scriptProgram) resolveIdentifier(context *scriptContext, name string) scriptValue {
	if value, ok := context.env[name]; ok {
		return value
	}
	file := context.file
	for function := context.function; function >= -1; function = file.parentOf(function) {
		if declaration := file.findDeclaration(name, function, context.position); declaration != nil {
			return program.evalDeclaration(file, declaration, context)
		}
		if function >= 0 {
			owner := file.functions[function]
			for index, param := range owner.params {
				if param.name == name {
					return paramValue(scriptParamRef{function: owner, index: index})
				}
				for _, pattern := range param.pattern {
					if pattern.name == name {
						return dynamicValue()
					}
				}
			}
		}
	}
	if program.resolveFunction(file, context.function, name) != nil {
		return opaqueValue()
	}
	if imported, ok := file.imports[name]; ok {
		return program.importedValue(file, imported, context.depth+1)
	}
	return dynamicValue()
}

func (program *scriptProgram) evalDeclaration(file *scriptFile, declaration *scriptDeclaration, context *scriptContext) scriptValue {
	env := context.env
	if declaration.function == -1 {
		env = nil
	}
	key := "decl#" + file.source.path + "#" + strconv.Itoa(declaration.initStart) + "#" + strconv.Itoa(declaration.position)
	if env == nil {
		if value, ok := program.memo[key]; ok {
			return applyPath(value, declaration.path)
		}
	}
	if program.evaluating[key] {
		return dynamicValue()
	}
	program.evaluating[key] = true
	inner := &scriptContext{file: file, function: declaration.function, env: env, depth: context.depth + 1, position: declaration.initStart}
	value := program.eval(inner, declaration.initStart, declaration.initEnd)
	delete(program.evaluating, key)
	if env == nil {
		program.memo[key] = value
	}
	return applyPath(value, declaration.path)
}

func (program *scriptProgram) importedValue(file *scriptFile, imported scriptImport, depth int) scriptValue {
	module := program.resolveModule(file, imported.module)
	if module == nil || depth > scriptDepthLimit {
		return dynamicValue()
	}
	switch imported.imported {
	case "*":
		return opaqueValue()
	case "default":
		if module.defaultExport == "" {
			return opaqueValue()
		}
		return program.topLevelValue(module, module.defaultExport, depth+1)
	}
	return program.exportedValue(module, imported.imported, depth+1)
}

func (program *scriptProgram) exportedValue(module *scriptFile, name string, depth int) scriptValue {
	if depth > scriptDepthLimit {
		return dynamicValue()
	}
	if exported, ok := module.exports[name]; ok {
		if exported.module != "" {
			return program.importedValue(module, scriptImport{module: exported.module, imported: exported.imported}, depth+1)
		}
		return program.topLevelValue(module, exported.local, depth+1)
	}
	if module.findDeclaration(name, -1, len(module.tokens)) != nil || module.declaredFunction(name, -1) != nil {
		return program.topLevelValue(module, name, depth+1)
	}
	for _, star := range module.starExports {
		if target := program.resolveModule(module, star); target != nil {
			if value := program.exportedValue(target, name, depth+1); value.kind != valueDynamic {
				return value
			}
		}
	}
	return dynamicValue()
}

func (program *scriptProgram) topLevelValue(module *scriptFile, name string, depth int) scriptValue {
	return program.resolveIdentifier(&scriptContext{file: module, function: -1, depth: depth, position: len(module.tokens)}, name)
}

func (file *scriptFile) declaredFunction(name string, parent int) *scriptFunction {
	for _, function := range file.functions {
		if function.parent == parent && function.name == name && function.kind == functionDeclared {
			return function
		}
	}
	return nil
}

func (program *scriptProgram) resolveFunction(file *scriptFile, function int, name string) *scriptFunction {
	for scope := function; scope >= -1; scope = file.parentOf(scope) {
		if found := file.declaredFunction(name, scope); found != nil {
			return found
		}
	}
	if imported, ok := file.imports[name]; ok {
		module := program.resolveModule(file, imported.module)
		if module == nil {
			return nil
		}
		target := imported.imported
		if target == "default" {
			target = module.defaultExport
		}
		if target == "" || target == "*" {
			return nil
		}
		return program.exportedFunction(module, target, 0)
	}
	return nil
}

func (program *scriptProgram) exportedFunction(module *scriptFile, name string, depth int) *scriptFunction {
	if depth > scriptDepthLimit {
		return nil
	}
	if exported, ok := module.exports[name]; ok {
		if exported.module != "" {
			target := program.resolveModule(module, exported.module)
			if target == nil {
				return nil
			}
			imported := exported.imported
			if imported == "default" {
				imported = target.defaultExport
			}
			return program.exportedFunction(target, imported, depth+1)
		}
		name = exported.local
	}
	if function := module.declaredFunction(name, -1); function != nil {
		return function
	}
	if _, ok := module.imports[name]; ok {
		return program.resolveFunction(module, -1, name)
	}
	for _, star := range module.starExports {
		if target := program.resolveModule(module, star); target != nil {
			if function := program.exportedFunction(target, name, depth+1); function != nil {
				return function
			}
		}
	}
	return nil
}

func (program *scriptProgram) resolveModule(file *scriptFile, specifier string) *scriptFile {
	var base string
	switch {
	case strings.HasPrefix(specifier, "~/"):
		base = path.Join(file.srcRoot, strings.TrimPrefix(specifier, "~/"))
	case strings.HasPrefix(specifier, "./") || strings.HasPrefix(specifier, "../"):
		base = path.Join(path.Dir(file.source.path), specifier)
	case strings.HasPrefix(specifier, "@unbound-plugins/shared/"):
		base = path.Join("packages/plugins-shared/src", strings.TrimPrefix(specifier, "@unbound-plugins/shared/"))
	default:
		return nil
	}
	for _, candidate := range []string{base, base + ".ts", base + ".tsx", base + "/index.ts", base + "/index.tsx"} {
		if target := program.files[candidate]; target != nil {
			return target
		}
	}
	return nil
}

func (program *scriptProgram) receivers(file *scriptFile, name string) []scriptReceiver {
	key := file.source.path + "#" + name
	if cached, ok := program.receiverCache[key]; ok {
		return cached
	}
	program.receiverCache[key] = nil
	var receivers []scriptReceiver
	collect := func(owner *scriptFile) {
		for _, annotation := range owner.annotations[name] {
			receivers = append(receivers, program.annotationReceivers(owner, annotation)...)
		}
	}
	collect(file)
	if len(receivers) == 0 {
		for _, other := range program.components[file.source.component] {
			if other != file {
				collect(other)
			}
		}
	}
	unique := receivers[:0]
	seen := map[string]bool{}
	for _, receiver := range receivers {
		identity := receiver.bridge
		if receiver.factory != nil {
			identity = receiver.factory.file.source.path + "#" + strconv.Itoa(receiver.factory.index)
		}
		if !seen[identity] {
			seen[identity] = true
			unique = append(unique, receiver)
		}
	}
	program.receiverCache[key] = unique
	return unique
}

func (program *scriptProgram) annotationReceivers(file *scriptFile, annotation scriptAnnotation) []scriptReceiver {
	if annotation.factory >= 0 {
		function := program.resolveFunction(file, file.scope[annotation.factory], file.value(annotation.factory))
		if function != nil && len(program.factoryMembers(function)) > 0 {
			return []scriptReceiver{{factory: function}}
		}
		return nil
	}
	return program.typeReceivers(file, annotation.typeStart, annotation.typeEnd, 0)
}

func (program *scriptProgram) typeReceivers(file *scriptFile, start, end, depth int) []scriptReceiver {
	if depth > 4 {
		return nil
	}
	var receivers []scriptReceiver
	for position := start; position < end && position < len(file.tokens); position++ {
		if !file.isIdentifier(position) {
			continue
		}
		value := file.value(position)
		if bridge, ok := scriptBridgeTypes[value]; ok {
			receivers = append(receivers, scriptReceiver{bridge: bridge})
		}
		if value == "typeof" && file.isIdentifier(position+1) {
			if function := program.resolveFunction(file, -1, file.value(position+1)); function != nil && len(program.factoryMembers(function)) > 0 {
				receivers = append(receivers, scriptReceiver{factory: function})
			}
		}
	}
	if len(receivers) == 0 && file.isPunctuation(start, "{") {
		if bridge := bridgeShapedType(file, start); bridge != "" {
			receivers = append(receivers, scriptReceiver{bridge: bridge})
		}
	}
	if len(receivers) > 0 || !file.isIdentifier(start) {
		return receivers
	}
	typeName := file.value(start)
	if alias, owner := program.findTypeAlias(file, typeName); owner != nil {
		receivers = append(receivers, program.typeReceivers(owner, alias.start, alias.end, depth+1)...)
	}
	for _, owner := range program.typeScope(file) {
		for _, function := range owner.functions {
			if function.returnType == typeName && function.parent == -1 && len(program.factoryMembers(function)) > 0 {
				receivers = append(receivers, scriptReceiver{factory: function})
			}
		}
	}
	return receivers
}

var scriptBridgeOnlyMembers = map[string]string{
	"getIvar": "objc", "setIvar": "objc", "findViews": "objc", "callSuper": "objc", "invokeSuper": "objc",
	"invokeSuperAsync": "objc", "alloc": "objc", "getField": "java", "setField": "java", "construct": "java",
}

func bridgeShapedType(file *scriptFile, start int) string {
	close := file.match[start]
	if close < 0 {
		return ""
	}
	bridge := ""
	for _, part := range file.splitTopLevel(start+1, close, ";") {
		for _, member := range file.splitTopLevel(part[0], part[1], ",") {
			position := member[0]
			if !file.isIdentifier(position) || !(file.isPunctuation(position+1, "(") || file.isPunctuation(position+1, "<") || file.isPunctuation(position+1, ":")) {
				continue
			}
			if kind, ok := scriptBridgeOnlyMembers[file.value(position)]; ok {
				if bridge != "" && bridge != kind {
					return ""
				}
				bridge = kind
			}
		}
	}
	return bridge
}

func (program *scriptProgram) typeScope(file *scriptFile) []*scriptFile {
	files := append([]*scriptFile{}, program.components[file.source.component]...)
	if file.source.component != "plugins-shared" {
		files = append(files, program.components["plugins-shared"]...)
	}
	return files
}

func (program *scriptProgram) findTypeAlias(file *scriptFile, name string) (scriptTypeAlias, *scriptFile) {
	if alias, ok := file.typeAliases[name]; ok {
		return alias, file
	}
	if imported, ok := file.imports[name]; ok {
		if module := program.resolveModule(file, imported.module); module != nil {
			if alias, ok := module.typeAliases[imported.imported]; ok {
				return alias, module
			}
		}
	}
	for _, owner := range program.typeScope(file) {
		if alias, ok := owner.typeAliases[name]; ok {
			return alias, owner
		}
	}
	return scriptTypeAlias{}, nil
}

func (program *scriptProgram) factoryMembers(function *scriptFunction) map[string]*scriptFunction {
	if members, ok := program.memberCache[function]; ok {
		return members
	}
	members := map[string]*scriptFunction{}
	program.memberCache[function] = members
	file := function.file
	var objects []int
	if !function.block {
		if file.isPunctuation(function.bodyStart, "(") && file.isPunctuation(function.bodyStart+1, "{") {
			objects = append(objects, function.bodyStart+1)
		}
	} else {
		for _, position := range program.returns(function) {
			if file.isPunctuation(position+1, "{") {
				objects = append(objects, position+1)
			}
		}
	}
	for _, open := range objects {
		close := file.match[open]
		if close < 0 {
			continue
		}
		for _, part := range file.splitTopLevel(open+1, close, ",") {
			start := part[0]
			if file.value(start) == "async" && file.isIdentifier(start+1) && !file.isPunctuation(start+1, ":") {
				start++
			}
			if !file.isIdentifier(start) {
				continue
			}
			key := file.value(start)
			switch {
			case part[1]-start == 1:
				if member := program.resolveFunction(file, function.index, key); member != nil {
					members[key] = member
				}
			case file.isPunctuation(start+1, ":"):
				if member := file.functionAt[start+2]; member != nil {
					members[key] = member
				} else if file.isIdentifier(start+2) && part[1]-start == 3 {
					if member := program.resolveFunction(file, function.index, file.value(start+2)); member != nil {
						members[key] = member
					}
				}
			default:
				if member := file.functionAt[start]; member != nil {
					members[key] = member
				}
			}
		}
	}
	return members
}

func (program *scriptProgram) factoryMember(function *scriptFunction, name string) *scriptFunction {
	return program.factoryMembers(function)[name]
}

func (program *scriptProgram) reportUncalledForwarders() {
	var functions []*scriptFunction
	for function, templates := range program.templates {
		if len(templates) > 0 && !program.instantiated[function] {
			functions = append(functions, function)
		}
	}
	sort.Slice(functions, func(left, right int) bool {
		a, b := functions[left], functions[right]
		if a.file.source.path != b.file.source.path {
			return a.file.source.path < b.file.source.path
		}
		return a.start < b.start
	})
	for _, function := range functions {
		if !program.referencedAsValue(function) {
			continue
		}
		var location compatLocation
		for _, template := range program.templates[function] {
			if location.File == "" || template.location.Line < location.Line {
				location = template.location
			}
		}
		component := function.file.source.component
		key := location.File + ":" + strconv.Itoa(location.Line) + ":" + function.name
		if program.dynamicSeen[key] {
			continue
		}
		program.dynamicSeen[key] = true
		program.set.dynamic[component]++
		program.set.dynamicSites = append(program.set.dynamicSites, compatDynamicSite{
			Component: component, Call: function.name + " (not called with names the scan can read)", Location: location,
		})
	}
}

func (program *scriptProgram) referencedAsValue(function *scriptFunction) bool {
	files := program.components[function.file.source.component]
	if function.file.source.component == "plugins-shared" {
		files = program.ordered
	}
	for _, file := range files {
		for index, token := range file.tokens {
			if token.kind != tokenIdentifier || token.value != function.name || file.definitions[index] || file.statements[index] {
				continue
			}
			next := index + 1
			if file.isPunctuation(next, "<") {
				next = file.skipGenerics(next)
			}
			if file.isPunctuation(next, "(") {
				continue
			}
			if function.kind == functionMember {
				if file.isPunctuation(index-1, ".") {
					return true
				}
				continue
			}
			if file.isPunctuation(index-1, ".") || file.isPunctuation(index+1, ":") || file.value(index-1) == "const" || file.value(index-1) == "let" {
				continue
			}
			if program.resolveFunction(file, file.scope[index], token.value) == function {
				return true
			}
		}
	}
	return false
}
