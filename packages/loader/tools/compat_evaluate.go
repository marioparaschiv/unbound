package main

import "strings"

func (target *compatTarget) sdkChainDeclares(className, selector string) bool {
	if target.sdk == nil {
		return false
	}
	if found, _ := target.sdk.declares(className, selector); found {
		return true
	}
	visited := map[string]bool{}
	for current := target.sdk.Classes[className]; current != nil && !visited[current.Name]; current = target.sdk.Classes[current.Super] {
		visited[current.Name] = true
		if category := target.objc.Classes["category:"+current.Name]; category != nil && category.Methods[selector] {
			return true
		}
	}
	return false
}

func evaluateObjCReference(reference *compatReference, target *compatTarget, seen map[string]bool, unlessSeen func(string) (string, string)) (string, string, bool) {
	objc, sdk := target.objc, target.sdk
	key := reference.key()
	switch reference.Kind {
	case referenceObjCClass:
		if objc.Classes[reference.Name] != nil || sdk != nil && sdk.hasClass(reference.Name) {
			return compatOK, "", true
		}
		if reason, ok := compatEnvironmentClasses[reference.Name]; ok {
			return compatExternal, reason, true
		}
		if discordObjCClassRegex.MatchString(reference.Name) || (reference.Strict && !isAppleClassName(reference.Name)) || seen[key] {
			return compatBroken, "class `" + reference.Name + "` is not in Discord's binaries" + similarClassNames(reference.Name, sortedObjCClassNames(objc)), true
		}
		if sdk != nil {
			return compatBroken, "class `" + reference.Name + "` is not in the iOS SDK or Discord's binaries", true
		}
		return compatUnverified, "class `" + reference.Name + "` is not in Discord's binaries, assumed to be a system class", true
	case referenceObjCMethod:
		if reference.Class == "" {
			if objc.Selectors[reference.Name] || sdk != nil && sdk.Selectors[reference.Name] {
				return compatOK, "", true
			}
			if sdk != nil {
				if seen[key] {
					return compatBroken, "no Discord or iOS SDK class declares `" + reference.Name + "` any more", true
				}
				return compatPossible, "no Discord or iOS SDK class declares `" + reference.Name + "`", true
			}
			status, reason := unlessSeen("no Discord class uses `" + reference.Name + "`")
			return status, reason, true
		}
		if objc.Classes[reference.Class] == nil {
			if sdk == nil || sdk.Classes[reference.Class] == nil {
				return "", "", true
			}
			if target.sdkChainDeclares(reference.Class, reference.Name) || objc.Classes["category:"+reference.Class] != nil && objc.Classes["category:"+reference.Class].Methods[reference.Name] {
				return compatOK, "", true
			}
			return compatPossible, "`" + reference.Class + "` does not declare `" + reference.Name + "` in the iOS SDK", true
		}
		switch result, owner := objc.lookupMethod(reference.Class, reference.Name); result {
		case objcFound:
			return compatOK, "", true
		case objcInheritedExternally:
			if target.sdkChainDeclares(owner, reference.Name) {
				return compatOK, "", true
			}
			if sdk != nil && sdk.Classes[owner] != nil {
				if seen[key] {
					return compatBroken, "`" + reference.Class + "` and its iOS SDK superclass `" + owner + "` no longer declare `" + reference.Name + "`", true
				}
				return compatPossible, "neither `" + reference.Class + "` nor its iOS SDK superclass `" + owner + "` declares `" + reference.Name + "`", true
			}
			status, reason := unlessSeen("not defined by Discord, may be inherited from `" + owner + "`")
			return status, reason, true
		default:
			similar := similarNames(reference.Name, setNames(objc.Classes[reference.Class].Methods))
			if seen[key] {
				return compatBroken, "`" + reference.Class + "` no longer defines `" + reference.Name + "`" + similar, true
			}
			return compatPossible, "`" + reference.Class + "` does not define `" + reference.Name + "`" + similar, true
		}
	case referenceObjCIvar:
		if objc.Ivars[reference.Name] {
			return compatOK, "", true
		}
		similar := similarNames(reference.Name, setNames(objc.Ivars))
		if seen[key] {
			return compatBroken, "no Discord class has the ivar `" + reference.Name + "` any more" + similar, true
		}
		return compatPossible, "no Discord class has the ivar `" + reference.Name + "`" + similar, true
	}
	return "", "", false
}

func hasJavaMethodName(target *compatTarget, name string) bool {
	return target.dex.MethodNames[name] || target.framework != nil && target.framework.MethodNames[name] || target.own != nil && target.own.MethodNames[name]
}

func hasJavaFieldName(target *compatTarget, name string) bool {
	return target.dex.FieldNames[name] || target.framework != nil && target.framework.FieldNames[name] || target.own != nil && target.own.FieldNames[name]
}

func evaluateJavaReference(reference *compatReference, target *compatTarget, unlessSeen func(string) (string, string)) (string, string, bool) {
	dex, framework := target.dex, target.framework
	parameters := ""
	if reference.Parameters != nil {
		parameters = javaParameterDescriptors(reference.Parameters)
	}
	signature := func(method string) string {
		return "`" + method + "` exists but takes different parameters than (" + strings.Join(reference.Parameters, ", ") + ")"
	}
	switch reference.Kind {
	case referenceJavaClass:
		if isOwnJavaName(reference.Name) {
			if target.own != nil && target.own.Classes[reference.Name] != nil {
				return compatOK, "", true
			}
			return compatBroken, "class `" + reference.Name + "` is not in the loader's sources", true
		}
		if dex.Classes[reference.Name] != nil || framework != nil && framework.Classes[reference.Name] != nil {
			return compatOK, "", true
		}
		if reason, ok := compatEnvironmentClasses[reference.Name]; ok {
			return compatExternal, reason, true
		}
		if framework != nil && isSystemJavaClass(reference.Name) {
			return compatBroken, "class `" + reference.Name + "` is not in the public Android SDK or Discord's dex", true
		}
		return compatBroken, "class `" + reference.Name + "` is not in Discord's dex" + similarClassNames(reference.Name, sortedDexClassNames(dex)), true
	case referenceJavaMethod:
		if reference.Class == "" {
			if hasJavaMethodName(target, reference.Name) {
				return compatOK, "", true
			}
			if strings.Contains(reference.Name, "-") {
				return compatBroken, "the Kotlin method `" + reference.Name + "` is gone, its signature probably changed", true
			}
			if framework != nil {
				status, reason := unlessSeen("no Discord, Android SDK or loader code defines or calls `" + reference.Name + "`")
				return status, reason, true
			}
			status, reason := unlessSeen("no Discord code defines or calls `" + reference.Name + "`")
			return status, reason, true
		}
		if isOwnJavaName(reference.Class) {
			if target.own == nil || target.own.Classes[reference.Class] == nil {
				return "", "", true
			}
			if result, _ := target.own.lookupMethod(reference.Class, reference.Name, ""); result == dexFound {
				return compatOK, "", true
			}
			return compatBroken, "the loader's `" + reference.Class + "` has no method `" + reference.Name + "`", true
		}
		owner := reference.Class
		if dex.Classes[reference.Class] != nil {
			result, external := dex.lookupMethod(reference.Class, reference.Name, parameters)
			switch result {
			case dexFound:
				return compatOK, "", true
			case dexSignatureMismatch:
				return compatBroken, signature(reference.Name), true
			case dexMissing:
				return compatBroken, "`" + reference.Class + "` has no method `" + reference.Name + "`" + similarNames(reference.Name, setNames(dex.Classes[reference.Class].Methods)), true
			}
			owner = external
		}
		if framework == nil || framework.Classes[owner] == nil {
			if dex.Classes[reference.Class] == nil {
				return "", "", true
			}
			status, reason := unlessSeen("not defined by Discord, may be inherited from `" + owner + "`" + similarNames(reference.Name, setNames(dex.Classes[reference.Class].Methods)))
			return status, reason, true
		}
		switch result, _ := framework.lookupMethod(owner, reference.Name, parameters); result {
		case dexFound:
			return compatOK, "", true
		case dexSignatureMismatch:
			return compatBroken, signature(reference.Name), true
		}
		if owner != reference.Class {
			return compatBroken, "neither `" + reference.Class + "` nor its Android SDK superclass `" + owner + "` has a method `" + reference.Name + "`", true
		}
		return compatBroken, "`" + reference.Class + "` has no public method `" + reference.Name + "` in the Android SDK", true
	case referenceJavaField:
		if hasJavaFieldName(target, reference.Name) {
			return compatOK, "", true
		}
		if framework != nil {
			status, reason := unlessSeen("no Discord, Android SDK or loader code defines or reads the field `" + reference.Name + "`")
			return status, reason, true
		}
		status, reason := unlessSeen("no Discord code defines or reads the field `" + reference.Name + "`" + similarNames(reference.Name, setNames(target.dex.FieldNames)))
		return status, reason, true
	}
	return "", "", false
}
