package main

import (
	"fmt"
	"path"
	"strings"
)

type scriptFunctionKind int

const (
	functionDeclared scriptFunctionKind = iota
	functionMember
	functionProperty
	functionAnonymous
)

type scriptPathStep struct {
	index    int
	key      string
	restFrom int
}

type scriptPatternName struct {
	name string
	path []scriptPathStep
}

type scriptParam struct {
	name    string
	rest    bool
	pattern []scriptPatternName
}

type scriptFunction struct {
	file       *scriptFile
	index      int
	name       string
	kind       scriptFunctionKind
	params     []scriptParam
	start      int
	nameToken  int
	bodyStart  int
	bodyEnd    int
	block      bool
	parent     int
	returnType string
}

type scriptDeclaration struct {
	name      string
	function  int
	position  int
	initStart int
	initEnd   int
	path      []scriptPathStep
}

type scriptBinding struct {
	start       int
	end         int
	function    int
	pattern     []scriptPatternName
	sourceStart int
	sourceEnd   int
}

type scriptImport struct {
	module   string
	imported string
}

type scriptReexport struct {
	module   string
	imported string
	local    string
}

type scriptAnnotation struct {
	typeStart int
	typeEnd   int
	factory   int
}

type scriptTypeAlias struct {
	start int
	end   int
}

type scriptFile struct {
	source        compatSourceFile
	srcRoot       string
	tokens        []compatToken
	match         []int
	enclosing     []int
	functions     []*scriptFunction
	functionAt    map[int]*scriptFunction
	definitions   map[int]bool
	scope         []int
	declarations  map[string][]*scriptDeclaration
	bindings      []*scriptBinding
	imports       map[string]scriptImport
	exports       map[string]scriptReexport
	starExports   []string
	defaultExport string
	annotations   map[string][]scriptAnnotation
	typeAliases   map[string]scriptTypeAlias
	statements    []bool
	fallbacks     []scriptFallback
	legacy        [][2]int
}

type scriptFallback struct {
	call         int
	alternatives [][2]int
}

var scriptKeywords = map[string]bool{
	"if": true, "for": true, "while": true, "switch": true, "catch": true, "function": true, "return": true,
	"with": true, "typeof": true, "await": true, "new": true, "do": true, "else": true, "case": true,
	"throw": true, "delete": true, "void": true, "in": true, "of": true, "instanceof": true, "yield": true,
	"import": true, "export": true, "const": true, "let": true, "var": true, "class": true, "super": true,
	"this": true, "default": true, "try": true, "finally": true, "break": true, "continue": true,
}

var scriptCallbackMethods = map[string]bool{
	"map": true, "filter": true, "forEach": true, "some": true, "find": true, "every": true,
	"flatMap": true, "findIndex": true, "findLast": true, "findLastIndex": true,
}

func newScriptFile(source compatSourceFile, srcRoot string, tokens []compatToken) *scriptFile {
	file := &scriptFile{
		source:       source,
		srcRoot:      srcRoot,
		tokens:       tokens,
		functionAt:   map[int]*scriptFunction{},
		definitions:  map[int]bool{},
		declarations: map[string][]*scriptDeclaration{},
		imports:      map[string]scriptImport{},
		exports:      map[string]scriptReexport{},
		annotations:  map[string][]scriptAnnotation{},
		typeAliases:  map[string]scriptTypeAlias{},
	}
	file.matchBrackets()
	file.parseFunctions()
	file.assignScopes()
	file.parseDeclarations()
	file.parseBindings()
	file.parseModuleStatements()
	file.parseAnnotations()
	file.parseFallbacks()
	return file
}

func (file *scriptFile) parseFallbacks() {
	for index := range file.tokens {
		open := index + 1
		if file.value(index) != "firstOf" || !file.isIdentifier(index) || !file.isPunctuation(open, "(") || file.match[open] < 0 {
			continue
		}
		file.fallbacks = append(file.fallbacks, scriptFallback{call: index, alternatives: file.splitTopLevel(open+1, file.match[open], ",")})
	}
	for index := range file.tokens {
		open := index + 1
		if file.value(index) == "legacyJavaClass" && file.isIdentifier(index) && file.isPunctuation(open, "(") && file.match[open] >= 0 {
			file.legacy = append(file.legacy, [2]int{open + 1, file.match[open]})
		}
	}
}

func (file *scriptFile) legacyAt(position int) bool {
	for _, span := range file.legacy {
		if position >= span[0] && position < span[1] {
			return true
		}
	}
	return false
}

func (file *scriptFile) fallbackAt(position int) (string, int, int) {
	group, alternative, count, width := "", 0, 0, -1
	for _, fallback := range file.fallbacks {
		for index, span := range fallback.alternatives {
			if position < span[0] || position >= span[1] || width >= 0 && span[1]-span[0] >= width {
				continue
			}
			group = fmt.Sprintf("%s:%d", file.source.path, file.tokens[fallback.call].line)
			alternative, count, width = index, len(fallback.alternatives), span[1]-span[0]
		}
	}
	return group, alternative, count
}

func (file *scriptFile) value(index int) string {
	if index < 0 || index >= len(file.tokens) {
		return ""
	}
	return file.tokens[index].value
}

func (file *scriptFile) isIdentifier(index int) bool {
	return index >= 0 && index < len(file.tokens) && file.tokens[index].kind == tokenIdentifier
}

func (file *scriptFile) isPunctuation(index int, value string) bool {
	return index >= 0 && index < len(file.tokens) && file.tokens[index].kind == tokenPunctuation && file.tokens[index].value == value
}

func (file *scriptFile) matchBrackets() {
	file.match = make([]int, len(file.tokens))
	file.enclosing = make([]int, len(file.tokens))
	var stack []int
	for index, token := range file.tokens {
		file.match[index] = -1
		file.enclosing[index] = -1
		if len(stack) > 0 {
			file.enclosing[index] = stack[len(stack)-1]
		}
		if token.kind != tokenPunctuation {
			continue
		}
		switch token.value {
		case "(", "[", "{":
			stack = append(stack, index)
		case ")", "]", "}":
			if len(stack) > 0 {
				open := stack[len(stack)-1]
				stack = stack[:len(stack)-1]
				file.match[open] = index
				file.match[index] = open
				file.enclosing[index] = file.enclosing[open]
			}
		}
	}
}

func (file *scriptFile) isArrow(index int) bool {
	return file.isPunctuation(index, "=") && file.isPunctuation(index+1, ">") &&
		!strings.Contains("=!<>", file.value(index-1))
}

func (file *scriptFile) skipGenerics(index int) int {
	if !file.isPunctuation(index, "<") {
		return index
	}
	depth := 0
	for position := index; position < len(file.tokens) && position < index+64; position++ {
		switch file.value(position) {
		case "<":
			depth++
		case ">":
			if !file.isArrow(position - 1) {
				depth--
			}
			if depth == 0 {
				return position + 1
			}
		case ";", "{", "}":
			return index
		}
	}
	return index
}

func (file *scriptFile) bodyAfterReturnType(index int) (int, string) {
	if !file.isPunctuation(index, ":") {
		return index, ""
	}
	returnType := ""
	if file.isIdentifier(index + 1) {
		returnType = file.value(index + 1)
	}
	for position := index + 1; position < len(file.tokens); position++ {
		value := file.value(position)
		if file.isPunctuation(position, "{") {
			previous := file.value(position - 1)
			if previous == ":" || previous == "|" || previous == "&" || previous == "<" || previous == "," || previous == "(" {
				if file.match[position] < 0 {
					return -1, ""
				}
				position = file.match[position]
				continue
			}
			return position, returnType
		}
		if file.isPunctuation(position, "(") || file.isPunctuation(position, "[") {
			if file.match[position] < 0 {
				return -1, ""
			}
			position = file.match[position]
			continue
		}
		if value == ";" || value == ")" || value == "}" || file.isArrow(position) {
			return -1, ""
		}
	}
	return -1, ""
}

func (file *scriptFile) parseFunctions() {
	tokens := file.tokens
	for index := 0; index < len(tokens); index++ {
		switch {
		case tokens[index].kind == tokenIdentifier && tokens[index].value == "function":
			file.parseFunctionKeyword(index)
		case file.isArrow(index):
			file.parseArrow(index)
		case tokens[index].kind == tokenIdentifier && !scriptKeywords[tokens[index].value] && tokens[index].value != "constructor":
			file.parseMethodShorthand(index)
		}
	}
}

func (file *scriptFile) parseFunctionKeyword(index int) {
	position := index + 1
	if file.isPunctuation(position, "*") {
		position++
	}
	name := ""
	nameToken := -1
	if file.isIdentifier(position) {
		name, nameToken = file.value(position), position
		position++
	}
	position = file.skipGenerics(position)
	if !file.isPunctuation(position, "(") || file.match[position] < 0 {
		return
	}
	open := position
	body, returnType := file.bodyAfterReturnType(file.match[open] + 1)
	if body < 0 {
		body = file.match[open] + 1
	}
	if !file.isPunctuation(body, "{") || file.match[body] < 0 {
		return
	}
	start := index
	if file.value(index-1) == "async" {
		start = index - 1
	}
	function := &scriptFunction{
		file: file, name: name, nameToken: nameToken, kind: functionDeclared, start: start,
		params: file.parseParams(open), bodyStart: body + 1, bodyEnd: file.match[body], block: true,
		returnType: returnType,
	}
	if name == "" {
		function.name, function.kind = file.contextName(start)
	} else {
		file.definitions[nameToken] = true
	}
	file.addFunction(function, index, start)
}

func (file *scriptFile) parseArrow(index int) {
	var open, single int = -1, -1
	returnType := ""
	previous := index - 1
	switch {
	case file.isPunctuation(previous, ")"):
		open = file.match[previous]
	case file.isIdentifier(previous) && !scriptKeywords[file.value(previous)] && file.isSingleArrowParam(previous):
		single = previous
	default:
		colon := file.typeAnnotationStart(previous)
		if colon < 0 || !file.isPunctuation(colon-1, ")") {
			return
		}
		open = file.match[colon-1]
		if file.isIdentifier(colon + 1) {
			returnType = file.value(colon + 1)
		}
	}
	start := single
	var params []scriptParam
	if open >= 0 {
		start = open
		params = file.parseParams(open)
		if lessThan := open - 1; file.isPunctuation(lessThan, ">") {
			for position := lessThan; position > lessThan-32 && position >= 0; position-- {
				if file.isPunctuation(position, "<") {
					start = position
					break
				}
			}
		}
	} else {
		params = []scriptParam{{name: file.value(single)}}
	}
	if start < 0 {
		return
	}
	key := start
	if file.value(start-1) == "async" {
		start--
	}
	function := &scriptFunction{file: file, start: start, nameToken: -1, params: params, returnType: returnType}
	body := index + 2
	if file.isPunctuation(body, "{") && file.match[body] > body {
		function.bodyStart, function.bodyEnd, function.block = body+1, file.match[body], true
	} else {
		function.bodyStart, function.bodyEnd = body, file.expressionEnd(body, len(file.tokens))
	}
	function.name, function.kind = file.contextName(start)
	file.addFunction(function, key, start)
}

func (file *scriptFile) isSingleArrowParam(index int) bool {
	switch file.value(index - 1) {
	case "|", "&", ".", "<":
		return false
	case ":":
		return !file.isPunctuation(index-2, ")")
	}
	return true
}

func (file *scriptFile) typeAnnotationStart(index int) int {
	depth := 0
	for position := index; position >= 0 && position > index-48; position-- {
		value := file.value(position)
		if file.tokens[position].kind == tokenPunctuation {
			switch value {
			case ">", "]", ")", "}":
				depth++
				continue
			case "<", "[", "(", "{":
				depth--
				if depth < 0 {
					return -1
				}
				continue
			case ":":
				if depth == 0 {
					return position
				}
				continue
			case ".", "|", "&", ",", "?":
				continue
			case ";", "=":
				if depth == 0 {
					return -1
				}
				continue
			}
			if depth == 0 {
				return -1
			}
		}
	}
	return -1
}

func (file *scriptFile) parseMethodShorthand(index int) {
	position := index + 1
	position = file.skipGenerics(position)
	if !file.isPunctuation(position, "(") || file.match[position] < 0 {
		return
	}
	switch file.value(index - 1) {
	case "{", ",", ";", "}", "async", "get", "set", "static", "private", "public", "protected", "readonly", "*", "override":
	default:
		return
	}
	if file.value(index-1) == "}" || file.value(index-1) == ";" {
		if owner := file.enclosing[index]; owner < 0 || !file.isClassBody(owner) {
			return
		}
	}
	open := position
	body, returnType := file.bodyAfterReturnType(file.match[open] + 1)
	if body < 0 {
		body = file.match[open] + 1
	}
	if !file.isPunctuation(body, "{") || file.match[body] < 0 {
		return
	}
	function := &scriptFunction{
		file: file, name: file.value(index), nameToken: index, start: index, kind: functionProperty,
		params: file.parseParams(open), bodyStart: body + 1, bodyEnd: file.match[body], block: true,
		returnType: returnType,
	}
	if file.isFactoryObject(file.enclosing[index]) {
		function.kind = functionMember
	}
	file.definitions[index] = true
	file.addFunction(function, index, index)
}

func (file *scriptFile) isClassBody(open int) bool {
	for position := open - 1; position >= 0 && position > open-16; position-- {
		if file.value(position) == "class" {
			return true
		}
		if file.tokens[position].kind == tokenPunctuation && file.value(position) != "." && file.value(position) != "<" && file.value(position) != ">" && file.value(position) != "," {
			return false
		}
	}
	return false
}

func (file *scriptFile) isFactoryObject(open int) bool {
	if open < 0 || !file.isPunctuation(open, "{") {
		return false
	}
	previous := file.value(open - 1)
	if previous == "return" {
		return true
	}
	return previous == "(" && file.isPunctuation(open-2, ">") && file.isArrow(open-3)
}

func (file *scriptFile) contextName(start int) (string, scriptFunctionKind) {
	position := start - 1
	if file.isPunctuation(position, "(") || file.isPunctuation(position, ",") {
		return "", functionAnonymous
	}
	if file.isPunctuation(position, "=") && file.isIdentifier(position-1) {
		switch file.value(position - 2) {
		case "const", "let", "var":
			return file.value(position - 1), functionDeclared
		}
		return "", functionAnonymous
	}
	if file.isPunctuation(position, "=") {
		if colon := file.typeAnnotationStart(position - 1); colon > 0 && file.isIdentifier(colon-1) {
			switch file.value(colon - 2) {
			case "const", "let", "var":
				return file.value(colon - 1), functionDeclared
			}
		}
	}
	if file.isPunctuation(position, ":") && (file.isIdentifier(position-1) || file.tokens[position-1].kind == tokenString) {
		switch file.value(position - 2) {
		case "{", ",":
			if file.isFactoryObject(file.enclosing[position-1]) {
				return file.value(position - 1), functionMember
			}
			return file.value(position - 1), functionProperty
		}
	}
	return "", functionAnonymous
}

func (file *scriptFile) addFunction(function *scriptFunction, key, start int) {
	if _, exists := file.functionAt[key]; exists {
		return
	}
	function.index = len(file.functions)
	file.functions = append(file.functions, function)
	file.functionAt[key] = function
	if start != key {
		file.functionAt[start] = function
	}
}

func (file *scriptFile) splitTopLevel(start, end int, separator string) [][2]int {
	var parts [][2]int
	begin := start
	for position := start; position < end; position++ {
		if file.match[position] > position && strings.Contains("([{", file.value(position)) && file.tokens[position].kind == tokenPunctuation {
			position = file.match[position]
			continue
		}
		if file.isPunctuation(position, separator) {
			parts = append(parts, [2]int{begin, position})
			begin = position + 1
		}
	}
	if begin < end {
		parts = append(parts, [2]int{begin, end})
	}
	return parts
}

func (file *scriptFile) isSpread(position int) bool {
	return file.isPunctuation(position, ".") && file.isPunctuation(position+1, ".") && file.isPunctuation(position+2, ".")
}

func (file *scriptFile) parseParams(open int) []scriptParam {
	var params []scriptParam
	for _, part := range file.splitTopLevel(open+1, file.match[open], ",") {
		position := part[0]
		param := scriptParam{}
		if file.isSpread(position) {
			param.rest = true
			position += 3
		}
		switch {
		case file.isIdentifier(position):
			param.name = file.value(position)
		case file.isPunctuation(position, "{") || file.isPunctuation(position, "["):
			param.pattern = file.parsePattern(position, nil)
		}
		if param.name == "this" {
			continue
		}
		params = append(params, param)
	}
	return params
}

func (file *scriptFile) parsePattern(open int, prefix []scriptPathStep) []scriptPatternName {
	close := file.match[open]
	if close < 0 {
		return nil
	}
	extend := func(step scriptPathStep) []scriptPathStep {
		path := append([]scriptPathStep{}, prefix...)
		return append(path, step)
	}
	var names []scriptPatternName
	array := file.value(open) == "["
	for position, part := range file.splitTopLevel(open+1, close, ",") {
		start := part[0]
		if start >= part[1] {
			continue
		}
		rest := file.isSpread(start)
		if rest {
			start += 3
		}
		if array {
			step := scriptPathStep{index: position, restFrom: -1}
			if rest {
				step = scriptPathStep{index: -1, restFrom: position}
			}
			switch {
			case file.isIdentifier(start):
				names = append(names, scriptPatternName{name: file.value(start), path: extend(step)})
			case file.isPunctuation(start, "[") || file.isPunctuation(start, "{"):
				names = append(names, file.parsePattern(start, extend(step))...)
			}
			continue
		}
		if rest || !(file.isIdentifier(start) || file.tokens[start].kind == tokenString) {
			continue
		}
		key := file.value(start)
		step := scriptPathStep{index: -1, key: key, restFrom: -1}
		if file.isPunctuation(start+1, ":") {
			target := start + 2
			switch {
			case file.isIdentifier(target):
				names = append(names, scriptPatternName{name: file.value(target), path: extend(step)})
			case file.isPunctuation(target, "[") || file.isPunctuation(target, "{"):
				names = append(names, file.parsePattern(target, extend(step))...)
			}
			continue
		}
		names = append(names, scriptPatternName{name: key, path: extend(step)})
	}
	return names
}

func (file *scriptFile) assignScopes() {
	file.scope = make([]int, len(file.tokens))
	for index := range file.scope {
		file.scope[index] = -1
	}
	ordered := append([]*scriptFunction{}, file.functions...)
	sortFunctionsByStart(ordered)
	for _, function := range ordered {
		end := function.bodyEnd
		if end > len(file.tokens) {
			end = len(file.tokens)
		}
		for position := function.bodyStart; position < end; position++ {
			file.scope[position] = function.index
		}
	}
	for _, function := range file.functions {
		function.parent = -1
		if function.start >= 0 && function.start < len(file.scope) {
			function.parent = file.scope[function.start]
		}
	}
}

func sortFunctionsByStart(functions []*scriptFunction) {
	for left := 1; left < len(functions); left++ {
		for right := left; right > 0 && (functions[right].bodyStart < functions[right-1].bodyStart ||
			functions[right].bodyStart == functions[right-1].bodyStart && functions[right].bodyEnd > functions[right-1].bodyEnd); right-- {
			functions[right], functions[right-1] = functions[right-1], functions[right]
		}
	}
}

func (file *scriptFile) expressionEnd(start, limit int) int {
	tokens := file.tokens
	if limit > len(tokens) {
		limit = len(tokens)
	}
	for position := start; position < limit; position++ {
		token := tokens[position]
		if position > start && token.line != tokens[position-1].line && endsExpression(tokens[position-1]) && !continuesExpression(tokens[position]) {
			return position
		}
		if token.kind != tokenPunctuation {
			continue
		}
		switch token.value {
		case "(", "[", "{":
			if file.match[position] > position {
				position = file.match[position]
			}
		case ")", "]", "}", ",", ";":
			return position
		}
	}
	return limit
}

func endsExpression(token compatToken) bool {
	switch token.kind {
	case tokenString, tokenOther:
		return true
	case tokenIdentifier:
		switch token.value {
		case "as", "satisfies", "typeof", "await", "return", "new", "void", "in", "of", "instanceof", "keyof", "async", "yield", "case":
			return false
		}
		return true
	}
	return token.value == ")" || token.value == "]" || token.value == "}"
}

func continuesExpression(token compatToken) bool {
	if token.kind == tokenPunctuation {
		return token.value != "(" && token.value != "[" && token.value != "{" && token.value != "!" && token.value != "`"
	}
	switch token.value {
	case "as", "satisfies", "instanceof", "in":
		return true
	}
	return false
}

func (file *scriptFile) parseDeclarations() {
	tokens := file.tokens
	for index := 0; index < len(tokens); index++ {
		switch tokens[index].value {
		case "const", "let", "var":
		default:
			continue
		}
		if tokens[index].kind != tokenIdentifier || file.value(index-1) == "." {
			continue
		}
		position := index + 1
		for position < len(tokens) {
			patternStart := position
			var names []scriptPatternName
			switch {
			case file.isIdentifier(position):
				names = []scriptPatternName{{name: file.value(position)}}
				position++
			case (file.isPunctuation(position, "[") || file.isPunctuation(position, "{")) && file.match[position] > position:
				names = file.parsePattern(position, nil)
				position = file.match[position] + 1
			default:
				position = len(tokens)
				continue
			}
			if file.value(position) == "of" || file.value(position) == "in" {
				break
			}
			if file.isPunctuation(position, "!") {
				position++
			}
			if file.isPunctuation(position, ":") {
				position = file.typeEnd(position+1, true)
			}
			if !file.isPunctuation(position, "=") || file.isArrow(position) {
				if file.isPunctuation(position, ",") {
					position++
					continue
				}
				break
			}
			initStart := position + 1
			initEnd := file.expressionEnd(initStart, len(tokens))
			for _, name := range names {
				file.declarations[name.name] = append(file.declarations[name.name], &scriptDeclaration{
					name: name.name, function: file.scope[patternStart], position: patternStart,
					initStart: initStart, initEnd: initEnd, path: name.path,
				})
			}
			position = initEnd
			if file.isPunctuation(position, ",") {
				position++
				continue
			}
			break
		}
	}
}

func (file *scriptFile) typeEnd(position int, stopAtEquals bool) int {
	depth := 0
	for ; position < len(file.tokens); position++ {
		token := file.tokens[position]
		if token.kind != tokenPunctuation {
			if depth == 0 && position > 0 && token.line != file.tokens[position-1].line && endsExpression(file.tokens[position-1]) && token.kind == tokenIdentifier && file.value(position-1) != "|" && file.value(position-1) != "&" {
				return position
			}
			continue
		}
		switch token.value {
		case "(", "[", "{":
			if file.match[position] > position {
				position = file.match[position]
			}
		case "<":
			depth++
		case ">":
			if file.isArrow(position - 1) {
				continue
			}
			depth--
		case "=":
			if file.isArrow(position) {
				position++
				continue
			}
			if depth <= 0 && stopAtEquals {
				return position
			}
		case ",", ")", "]", "}", ";":
			if depth <= 0 {
				return position
			}
		}
	}
	return position
}

func (file *scriptFile) parseBindings() {
	tokens := file.tokens
	for index := 0; index+3 < len(tokens); index++ {
		if tokens[index].value != "for" || tokens[index].kind != tokenIdentifier || !file.isPunctuation(index+1, "(") {
			continue
		}
		close := file.match[index+1]
		position := index + 2
		if file.value(position) == "await" {
			position++
		}
		switch file.value(position) {
		case "const", "let", "var":
			position++
		}
		var pattern []scriptPatternName
		switch {
		case file.isIdentifier(position):
			pattern = []scriptPatternName{{name: file.value(position)}}
			position++
		case file.isPunctuation(position, "[") || file.isPunctuation(position, "{"):
			pattern = file.parsePattern(position, nil)
			position = file.match[position] + 1
		default:
			continue
		}
		if file.value(position) != "of" || close < 0 {
			continue
		}
		bodyStart := close + 1
		bodyEnd := 0
		if file.isPunctuation(bodyStart, "{") && file.match[bodyStart] > bodyStart {
			bodyEnd = file.match[bodyStart]
		} else {
			bodyEnd = file.statementEnd(bodyStart)
		}
		file.bindings = append(file.bindings, &scriptBinding{
			start: bodyStart, end: bodyEnd, function: file.scope[index], pattern: pattern,
			sourceStart: position + 1, sourceEnd: close,
		})
	}
	for _, function := range file.functions {
		if function.kind != functionAnonymous || len(function.params) == 0 {
			continue
		}
		open := function.start
		if file.value(open) == "async" {
			open++
		}
		if !file.isPunctuation(open-1, "(") || !scriptCallbackMethods[file.value(open-2)] || !file.isPunctuation(open-3, ".") {
			continue
		}
		receiverEnd := open - 3
		if file.isPunctuation(receiverEnd-1, "?") {
			receiverEnd--
		}
		receiverStart := file.postfixStart(receiverEnd - 1)
		if receiverStart < 0 || receiverStart >= receiverEnd {
			continue
		}
		param := function.params[0]
		pattern := param.pattern
		if param.name != "" {
			pattern = []scriptPatternName{{name: param.name}}
		}
		file.bindings = append(file.bindings, &scriptBinding{
			start: function.bodyStart, end: function.bodyEnd, function: file.scope[receiverStart], pattern: pattern,
			sourceStart: receiverStart, sourceEnd: receiverEnd,
		})
	}
}

func (file *scriptFile) statementEnd(start int) int {
	for position := start; position < len(file.tokens); position++ {
		if file.match[position] > position && file.tokens[position].kind == tokenPunctuation && strings.Contains("([{", file.value(position)) {
			position = file.match[position]
			continue
		}
		if file.isPunctuation(position, ";") || file.isPunctuation(position, "}") {
			return position
		}
		if position > start && file.tokens[position].line != file.tokens[position-1].line && endsExpression(file.tokens[position-1]) && !continuesExpression(file.tokens[position]) {
			return position
		}
	}
	return len(file.tokens)
}

func (file *scriptFile) postfixStart(end int) int {
	position := end
	for position >= 0 {
		token := file.tokens[position]
		if token.kind == tokenPunctuation && (token.value == ")" || token.value == "]") {
			open := file.match[position]
			if open < 0 {
				return -1
			}
			position = open
			previous := open - 1
			if previous >= 0 && (file.isIdentifier(previous) && !scriptKeywords[file.value(previous)] || file.isPunctuation(previous, ")") || file.isPunctuation(previous, "]")) {
				position = previous
				continue
			}
			if file.isPunctuation(previous, ">") {
				if generic := file.genericOpen(previous); generic > 0 && file.isIdentifier(generic-1) {
					position = generic - 1
					continue
				}
			}
			return position
		}
		if token.kind == tokenIdentifier || token.kind == tokenString {
			if file.isPunctuation(position-1, ".") {
				next := position - 2
				if file.isPunctuation(next, "?") {
					next--
				}
				if next >= 0 && (file.isIdentifier(next) || file.isPunctuation(next, ")") || file.isPunctuation(next, "]")) {
					position = next
					continue
				}
			}
			return position
		}
		return position + 1
	}
	return -1
}

func (file *scriptFile) genericOpen(close int) int {
	depth := 0
	for position := close; position >= 0 && position > close-32; position-- {
		switch file.value(position) {
		case ">":
			depth++
		case "<":
			depth--
			if depth == 0 {
				return position
			}
		case ";", "{", "}", "=":
			return -1
		}
	}
	return -1
}

func (file *scriptFile) parseModuleStatements() {
	tokens := file.tokens
	file.statements = make([]bool, len(tokens))
	mark := func(start, end int) {
		for position := start; position < end && position < len(tokens); position++ {
			file.statements[position] = true
		}
	}
	for index := 0; index < len(tokens); index++ {
		if tokens[index].kind != tokenIdentifier || file.scope[index] != -1 || file.value(index-1) == "." {
			continue
		}
		switch tokens[index].value {
		case "import":
			if file.isPunctuation(index+1, "(") {
				continue
			}
			end := index + 1
			for end < len(tokens) && tokens[end].kind != tokenString {
				end++
			}
			if end >= len(tokens) {
				continue
			}
			module := tokens[end].value
			mark(index, end+1)
			position := index + 1
			if file.value(position) == "type" && !file.isPunctuation(position+1, ",") && file.value(position+1) != "from" {
				position++
			}
			for position < end {
				switch {
				case file.isPunctuation(position, "{"):
					close := file.match[position]
					for _, part := range file.splitTopLevel(position+1, close, ",") {
						start := part[0]
						if file.value(start) == "type" && part[1]-start > 1 {
							start++
						}
						imported := file.value(start)
						local := imported
						if file.value(start+1) == "as" {
							local = file.value(start + 2)
						}
						file.imports[local] = scriptImport{module: module, imported: imported}
					}
					position = close + 1
				case file.isPunctuation(position, "*") && file.value(position+1) == "as":
					file.imports[file.value(position+2)] = scriptImport{module: module, imported: "*"}
					position += 3
				case file.isIdentifier(position) && file.value(position) != "from":
					file.imports[file.value(position)] = scriptImport{module: module, imported: "default"}
					position++
				default:
					position++
				}
			}
		case "export":
			position := index + 1
			switch {
			case file.value(position) == "default":
				if file.isIdentifier(position+1) && file.value(position+1) != "function" && file.value(position+1) != "class" {
					file.defaultExport = file.value(position + 1)
				} else if file.value(position+1) == "function" && file.isIdentifier(position+2) {
					file.defaultExport = file.value(position + 2)
				} else if file.isPunctuation(position+1, "{") {
					mark(index, file.match[position+1]+1)
				}
			case file.isPunctuation(position, "*"):
				end := position
				for end < len(tokens) && tokens[end].kind != tokenString {
					end++
				}
				if end < len(tokens) {
					file.starExports = append(file.starExports, tokens[end].value)
					mark(index, end+1)
				}
			case file.isPunctuation(position, "{") || file.value(position) == "type" && file.isPunctuation(position+1, "{"):
				if file.value(position) == "type" {
					position++
				}
				close := file.match[position]
				module := ""
				end := close + 1
				if file.value(close+1) == "from" && close+2 < len(tokens) {
					module = tokens[close+2].value
					end = close + 3
				}
				mark(index, end)
				for _, part := range file.splitTopLevel(position+1, close, ",") {
					start := part[0]
					if file.value(start) == "type" && part[1]-start > 1 {
						start++
					}
					local := file.value(start)
					exported := local
					if file.value(start+1) == "as" {
						exported = file.value(start + 2)
					}
					file.exports[exported] = scriptReexport{module: module, imported: local, local: local}
				}
			}
		}
	}
	for index := 0; index+2 < len(tokens); index++ {
		if tokens[index].value != "type" || tokens[index].kind != tokenIdentifier || !file.isIdentifier(index+1) || file.value(index-1) == "." {
			continue
		}
		position := file.skipGenerics(index + 2)
		if !file.isPunctuation(position, "=") {
			continue
		}
		file.typeAliases[file.value(index+1)] = scriptTypeAlias{start: position + 1, end: file.typeEnd(position+1, false)}
	}
}

func (file *scriptFile) parseAnnotations() {
	tokens := file.tokens
	for index := 1; index+2 < len(tokens); index++ {
		if !file.isIdentifier(index) {
			continue
		}
		switch file.value(index - 1) {
		case "(", ",", "{", ";":
		default:
			if tokens[index].line == tokens[index-1].line {
				continue
			}
		}
		position := index + 1
		if file.isPunctuation(position, "?") {
			position++
		}
		if !file.isPunctuation(position, ":") || !file.isIdentifier(position+1) {
			continue
		}
		typeStart := position + 1
		annotation := scriptAnnotation{typeStart: typeStart, typeEnd: file.typeEnd(typeStart, true), factory: -1}
		if file.isPunctuation(typeStart+1, "(") || file.isPunctuation(typeStart+1, "<") {
			annotation.factory = typeStart
		}
		file.annotations[tokens[index].value] = append(file.annotations[tokens[index].value], annotation)
	}
	for name, declarations := range file.declarations {
		for _, declaration := range declarations {
			if len(declaration.path) == 0 && file.isIdentifier(declaration.initStart) && (file.isPunctuation(declaration.initStart+1, "(") || file.isPunctuation(declaration.initStart+1, "<")) {
				file.annotations[name] = append(file.annotations[name], scriptAnnotation{typeStart: -1, typeEnd: -1, factory: declaration.initStart})
			}
		}
	}
}

func scriptSourceRoot(relative string) string {
	parts := strings.Split(relative, "/")
	for index, part := range parts {
		if part == "src" {
			return strings.Join(parts[:index+1], "/")
		}
	}
	return path.Dir(relative)
}
