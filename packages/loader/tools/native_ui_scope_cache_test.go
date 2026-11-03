package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

func TestUIScopeNamespaceIdentityAndDisposal(t *testing.T) {
	source, err := os.ReadFile(filepath.Join(loaderRoot(t), "bootstrap", "native-ui-scope-cache.js"))
	if err != nil {
		t.Fatal(err)
	}
	engine, err := exec.LookPath("bun")
	if err != nil {
		t.Skip("Bun is unavailable")
	}
	script := "const createCache = () => " + strings.TrimSuffix(strings.TrimSpace(string(source)), ";") + `;
const cache = createCache();
const check = (condition, message) => { if (!condition) throw new Error(message); };
let active = true;
const source = { invoke(value) { return this.factor * value; } };
const first = cache.create('1:java', source, () => active, 2);
check(cache.read('1:java') === first, 'a scope must reuse its namespace');
check(first.invoke.call({factor: 3}, 4) === 12, 'arguments, results and receiver must survive wrapping');
active = false;
let error;
try { first.invoke(1); } catch (failure) { error = failure; }
check(error?.code === 'NATIVE_PLUGIN_SCOPE_DISPOSED', 'cached operations must reject disposed scopes');
cache.erase('1:java');
check(cache.read('1:java') === undefined, 'explicit cleanup must release the namespace');
const other = createCache();
cache.create('2:java', source, () => true, 2);
check(other.read('2:java') === undefined, 'owning runtime caches must not share values');
const retained = cache.create('3:java', source, () => true, 2);
cache.create('4:java', source, () => true, 2);
check(cache.read('2:java') === undefined, 'the cache must enforce its capacity');
check(retained.invoke.call({factor: 2}, 5) === 10, 'eviction must not dispose a live scope');
check(cache.read('3:java') === retained, 'live entries below capacity must keep identity');
const several = createCache().create('5:objc', { hook: () => 'hook', invoke: () => 'invoke', getClass: () => 'getClass' }, () => true, 4);
check(several.hook() === 'hook' && several.invoke() === 'invoke' && several.getClass() === 'getClass', 'each wrapper must call its own operation');
`
	if output, err := exec.Command(engine, "-e", script).CombinedOutput(); err != nil {
		t.Fatalf("UI scope namespace cache misbehaves: %v\n%s", err, output)
	}
}

func TestBootstrapScriptsAvoidLoopBlockBindings(t *testing.T) {
	scripts, err := filepath.Glob(filepath.Join(loaderRoot(t), "bootstrap", "*.js"))
	if err != nil {
		t.Fatal(err)
	}
	loop := regexp.MustCompile(`\bfor\s*\(\s*(const|let)\b`)
	for _, script := range scripts {
		source, err := os.ReadFile(script)
		if err != nil {
			t.Fatal(err)
		}
		for index, line := range strings.Split(string(source), "\n") {
			if loop.MatchString(line) {
				t.Errorf("%s:%d declares a loop binding with const or let; Hermes compiles bootstrap source with one binding per function, so closures created in the loop all see its last value. Use forEach or a helper function instead.", filepath.Base(script), index+1)
			}
		}
	}
}
