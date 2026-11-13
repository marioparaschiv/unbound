package main

import "testing"

func TestCompatSkipsEmptyClassFallbacks(t *testing.T) {
	set := scriptProgramReferences(t, map[string]string{
		"packages/client/src/debugger/view-details.ts": `
export function chain(objc: NativeObjCBridge, view: unknown) {
	return objc.getClass(objc.className(view) ?? '');
}
`,
	})
	for _, reference := range set.sorted() {
		if reference.Kind == referenceObjCClass && reference.Name == "" {
			t.Fatalf("an empty class name became a reference: %+v", reference)
		}
	}
}

func TestMergeJavaFrameworkKeepsPublicAndAddsHidden(t *testing.T) {
	public := newJavaFrameworkIndex()
	public.add(&javaFrameworkClass{Name: "android.view.View", Methods: map[string][]string{"setAlpha": {"(F)V"}}, Fields: map[string]bool{}})
	hidden := newJavaFrameworkIndex()
	hidden.add(&javaFrameworkClass{Name: "android.view.View", Methods: map[string][]string{"getListenerInfo": {"()Landroid/view/View$ListenerInfo;"}}, Fields: map[string]bool{"mListenerInfo": true}})
	hidden.add(&javaFrameworkClass{Name: "android.util.PathParser", Methods: map[string][]string{"createPathFromPathData": {"(Ljava/lang/String;)Landroid/graphics/Path;"}}, Fields: map[string]bool{}})

	mergeJavaFrameworkIndex(public, hidden)

	view := public.Classes["android.view.View"]
	if view.Methods["setAlpha"] == nil || view.Methods["getListenerInfo"] == nil || !view.Fields["mListenerInfo"] {
		t.Fatalf("merged View lost or missed members: %+v", view)
	}
	if public.Classes["android.util.PathParser"] == nil || !public.MethodNames["createPathFromPathData"] || !public.FieldNames["mListenerInfo"] {
		t.Fatal("hidden classes and member names were not added")
	}
}

func TestSystemChainDeclaresWalksPrivateSuperclasses(t *testing.T) {
	system := newObjCIndex()
	system.Classes["UIView"] = &objcClass{Name: "UIView", Methods: map[string]bool{"_privateLayout": true}, Ivars: map[string]bool{}}
	system.Classes["_UIPrivateView"] = &objcClass{Name: "_UIPrivateView", Super: "UIView", SuperExternal: true, Methods: map[string]bool{}, Ivars: map[string]bool{}}
	target := &compatTarget{system: system}

	if !target.systemChainDeclares("_UIPrivateView", "_privateLayout") {
		t.Fatal("a private superclass method was not found")
	}
	if target.systemChainDeclares("_UIPrivateView", "missingSelector") {
		t.Fatal("a missing selector was reported as declared")
	}
}
