package app.unbound.android

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

open class HookedBase {
    fun ping(): Int = 1
}

class HookedDerived : HookedBase()

class HookPayloadTarget {
    fun receive(first: Any?, second: Any?): Int = if (first == second) 1 else 0
}

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class NativeHooksTest {
    private class RecordedHook(val method: java.lang.reflect.Executable, val hook: NativeHooks.Hook) {
        var removed = false
    }

    private class FakeInstaller : NativeHooks.Installer {
        val installed = ArrayList<RecordedHook>()

        override fun install(
            method: java.lang.reflect.Executable,
            hook: NativeHooks.Hook,
        ): NativeHooks.Removable {
            val record = RecordedHook(method, hook)
            installed.add(record)

            return object : NativeHooks.Removable {
                override fun remove() {
                    record.removed = true
                }
            }
        }
    }

    private class FakeChain(private val self: Any?, private val arguments: List<Any?>, private val original: Any?) : NativeHooks.Chain {
        var proceeded = false
        var proceededWith: List<Any?>? = null

        override fun target(): Any? = self
        override fun argument(index: Int): Any? = arguments[index]
        override fun argumentCount(): Int = arguments.size
        override fun proceed(): Any? {
            proceeded = true
            return original
        }

        override fun proceedWith(arguments: Array<Any?>): Any? {
            proceededWith = arguments.toList()
            return original
        }
    }

    private lateinit var installer: FakeInstaller
    private val dispatched = ArrayList<Pair<String, String>>()
    private var rewriteResponse: String? = null
    private val cached = HashMap<Triple<String, String, String>, String>()
    private val lookups = ArrayList<Triple<String, String, String>>()

    @Before
    fun setUp() {
        NativeHooks.removeAll()
        NativeJava.releaseAll()
        cached.clear()
        lookups.clear()
        NativeHooks.useReturnValues { token, selfJSON, argumentsJSON ->
            val key = Triple(token, selfJSON, argumentsJSON)
            lookups.add(key)
            cached[key]
        }
        installer = FakeInstaller()
        NativeHooks.useInstaller(installer)
        dispatched.clear()
        rewriteResponse = null
        NativeHooks.useDispatcher(object : NativeHooks.Dispatcher {
            override fun dispatch(token: String, payloadJSON: String): String? {
                dispatched.add(token to payloadJSON)
                return rewriteResponse
            }
        })
    }

    private fun hookToString(options: String = "{}"): String =
        NativeHooks.hook("java.lang.Integer", "toString", "[]", options)

    @Test
    fun hookResolvesTheTargetMethodAndReturnsAToken() {
        val token = hookToString()

        assertTrue(JSONObject(token).getString("id").startsWith("hook-"))
        assertEquals(1, installer.installed.size)
        assertEquals("toString", installer.installed[0].method.name)
        assertEquals(1, NativeHooks.installedCount())
    }

    @Test
    fun hookResolvesOverloadsByParameterTypeNames() {
        NativeHooks.hook("java.lang.String", "indexOf", """["int"]""", "{}")

        val method = installer.installed[0].method as java.lang.reflect.Method

        assertEquals(1, method.parameterCount)
        assertEquals(Integer.TYPE, method.parameterTypes[0])
    }

    @Test
    fun anInheritedMethodOnlyReportsReceiversOfTheRequestedClass() {
        NativeHooks.hook("app.unbound.android.HookedDerived", "ping", "[]", "{}")

        assertEquals(HookedBase::class.java, installer.installed[0].method.declaringClass)

        val base = FakeChain(HookedBase(), emptyList(), 1)
        installer.installed[0].hook.intercept(base)

        assertTrue(base.proceeded)
        assertEquals(0, dispatched.size)

        installer.installed[0].hook.intercept(FakeChain(HookedDerived(), emptyList(), 1))

        assertEquals(1, dispatched.size)
    }

    @Test
    fun hookRejectsAMethodThatDoesNotExist() {
        val error = assertThrows(IllegalArgumentException::class.java) {
            NativeHooks.hook("java.lang.Integer", "noSuchMethod", "[\"int\"]", "{}")
        }

        assertEquals("No method noSuchMethod(int) on java.lang.Integer or its superclasses", error.message)
        assertEquals(0, NativeHooks.installedCount())
    }

    @Test
    fun anObservingHookNotifiesAndStillCallsTheOriginal() {
        val token = hookToString()
        val chain = FakeChain(42, emptyList(), "original")

        val result = installer.installed[0].hook.intercept(chain)

        assertTrue(chain.proceeded)
        assertEquals("original", result)
        assertEquals(1, dispatched.size)
        assertEquals(JSONObject(token).getString("id"), dispatched[0].first)
    }

    @Test
    fun aReplacingHookWithoutACachedResultStillCallsTheOriginal() {
        hookToString("""{"replace":true}""")
        val chain = FakeChain(42, emptyList(), "original")

        assertEquals("original", installer.installed[0].hook.intercept(chain))
        assertTrue(chain.proceeded)
    }

    private fun cache(tokenJSON: String, selfJSON: String, argumentsJSON: String, valueJSON: String) {
        cached[Triple(JSONObject(tokenJSON).getString("id"), selfJSON, argumentsJSON)] = valueJSON
    }

    @Test
    fun aReplacingHookReturnsTheCachedResultWithoutCallingTheOriginal() {
        val token = hookToString("""{"replace":true}""")
        cache(token, """{"type":"int","value":42}""", "[]", """{"type":"string","value":"cached"}""")

        val chain = FakeChain(42, emptyList(), "original")
        val result = installer.installed[0].hook.intercept(chain)

        assertEquals("cached", result)
        assertEquals(false, chain.proceeded)
    }

    @Test
    fun aReplacingHookAsksTheCoreCacheWithTheDescribedReceiverAndArguments() {
        val token = hookToString("""{"replace":true}""")

        installer.installed[0].hook.intercept(FakeChain(42, listOf("alpha"), "original"))

        val lookup = lookups.single()
        assertEquals(JSONObject(token).getString("id"), lookup.first)
        assertEquals(42, JSONObject(lookup.second).getInt("value"))
        assertEquals("alpha", JSONArray(lookup.third).getJSONObject(0).getString("value"))
    }

    @Test
    fun aCachedResultOnlyAppliesToTheMatchingReceiverAndArguments() {
        val token = hookToString("""{"replace":true}""")
        cache(token, """{"type":"int","value":42}""", "[]", """{"type":"string","value":"cached"}""")

        val other = FakeChain(7, emptyList(), "original")

        assertEquals("original", installer.installed[0].hook.intercept(other))
        assertTrue(other.proceeded)
    }

    @Test
    fun anUndecodableCachedResultFallsBackToTheOriginal() {
        val token = hookToString("""{"replace":true}""")
        cache(token, """{"type":"int","value":42}""", "[]", """{"type":"handle","value":"java-999"}""")

        val chain = FakeChain(42, emptyList(), "original")

        assertEquals("original", installer.installed[0].hook.intercept(chain))
        assertTrue(chain.proceeded)
    }

    @Test
    fun anObservingHookNeverConsultsTheCache() {
        hookToString()
        installer.installed[0].hook.intercept(FakeChain(42, emptyList(), "original"))

        assertTrue(lookups.isEmpty())
    }

    @Test
    fun aSilentHookDoesNotNotify() {
        hookToString("""{"notify":false}""")
        installer.installed[0].hook.intercept(FakeChain(42, emptyList(), "original"))

        assertEquals(0, dispatched.size)
    }

    @Test
    fun removingAHookUnregistersIt() {
        val token = hookToString("""{"replace":true}""")

        NativeHooks.remove(token)

        assertEquals(0, NativeHooks.installedCount())
        assertTrue(installer.installed[0].removed)
        assertTrue(JSONObject(hookToString()).getString("id").isNotEmpty())
    }

    @Test
    fun theNotificationPayloadCarriesTheReceiverAndArguments() {
        hookToString()
        installer.installed[0].hook.intercept(FakeChain(42, listOf("alpha"), null))

        val payload = JSONObject(dispatched[0].second)

        assertEquals("int", payload.getJSONObject("self").getString("type"))
        assertEquals(42, payload.getJSONObject("self").getInt("value"))
        assertEquals("alpha", payload.getJSONArray("args").getJSONObject(0).getString("value"))
    }

    @Test
    fun payloadOptionsSelectReceiverArgumentsAndPhase() {
        NativeHooks.hook(
            "app.unbound.android.HookPayloadTarget",
            "receive",
            """["java.lang.Object","java.lang.Object"]""",
            """{"payload":{"receiver":false,"arguments":[1],"phase":"after"}}""",
        )
        val chain = FakeChain(HookPayloadTarget(), listOf("unused", "selected"), 1)

        installer.installed.single().hook.intercept(chain)

        assertTrue(chain.proceeded)
        val payload = JSONObject(dispatched.single().second)
        assertEquals(false, payload.has("self"))
        assertEquals("after", payload.getString("phase"))
        assertEquals(1, payload.getJSONArray("args").length())
        assertEquals(1, payload.getJSONArray("argumentIndexes").getInt(0))
        assertEquals("selected", payload.getJSONArray("args").getJSONObject(0).getString("value"))
    }

    @Test
    fun omittedPayloadValuesAreNotTurnedIntoNativeHandles() {
        NativeHooks.hook(
            "app.unbound.android.HookPayloadTarget",
            "receive",
            """["java.lang.Object","java.lang.Object"]""",
            """{"payload":{"receiver":false,"arguments":[]}}""",
        )

        installer.installed.single().hook.intercept(
            FakeChain(HookPayloadTarget(), listOf(Any(), Any()), 1),
        )

        assertEquals(0, NativeJava.liveHandles())
        assertEquals(0, JSONObject(dispatched.single().second).getJSONArray("args").length())
    }

    @Test
    fun payloadOptionsRejectInvalidArgumentIndexesAndPhases() {
        val invalidArgument = assertThrows(IllegalArgumentException::class.java) {
            NativeHooks.hook(
                "app.unbound.android.HookPayloadTarget",
                "receive",
                """["java.lang.Object","java.lang.Object"]""",
                """{"payload":{"arguments":[2]}}""",
            )
        }
        val invalidPhase = assertThrows(IllegalArgumentException::class.java) {
            NativeHooks.hook(
                "app.unbound.android.HookPayloadTarget",
                "receive",
                """["java.lang.Object","java.lang.Object"]""",
                """{"payload":{"phase":"during"}}""",
            )
        }

        assertTrue(invalidArgument.message.orEmpty().contains("argument index"))
        assertTrue(invalidPhase.message.orEmpty().contains("phase"))
        assertEquals(0, installer.installed.size)
    }

    @Test
    fun receiverCoalescingAllowsAfterObservationHooks() {
        NativeHooks.hook(
            "app.unbound.android.HookPayloadTarget",
            "receive",
            "[\"java.lang.Object\",\"java.lang.Object\"]",
            "{\"notify\":\"after\",\"coalesce\":\"receiver\"}",
        )
        val chain = FakeChain(HookPayloadTarget(), listOf("first", "second"), 1)

        installer.installed.single().hook.intercept(chain)

        assertTrue(chain.proceeded)
        assertEquals("after", JSONObject(dispatched.single().second).getString("phase"))
    }

    @Test
    fun receiverCoalescingRejectsSynchronousAndReplacingHooks() {
        val before = assertThrows(IllegalArgumentException::class.java) {
            NativeHooks.hook(
                "app.unbound.android.HookPayloadTarget",
                "receive",
                "[\"java.lang.Object\",\"java.lang.Object\"]",
                "{\"coalesce\":\"receiver\"}",
            )
        }
        val replacing = assertThrows(IllegalArgumentException::class.java) {
            NativeHooks.hook(
                "app.unbound.android.HookPayloadTarget",
                "receive",
                "[\"java.lang.Object\",\"java.lang.Object\"]",
                "{\"notify\":\"after\",\"replace\":true,\"coalesce\":\"receiver\"}",
            )
        }

        assertTrue(before.message.orEmpty().contains("after-observation"))
        assertTrue(replacing.message.orEmpty().contains("after-observation"))
        assertEquals(0, installer.installed.size)
    }

    @Test
    fun receiverCoalescingRejectsHooksWithoutReceiversAndStaticMethods() {
        val receiverless = assertThrows(IllegalArgumentException::class.java) {
            NativeHooks.hook(
                "app.unbound.android.HookPayloadTarget",
                "receive",
                "[\"java.lang.Object\",\"java.lang.Object\"]",
                "{\"notify\":\"after\",\"coalesce\":\"receiver\",\"payload\":{\"receiver\":false}}",
            )
        }
        val static = assertThrows(IllegalArgumentException::class.java) {
            NativeHooks.hook(
                "java.lang.Integer",
                "parseInt",
                "[\"java.lang.String\"]",
                "{\"notify\":\"after\",\"coalesce\":\"receiver\"}",
            )
        }

        assertTrue(receiverless.message.orEmpty().contains("after-observation"))
        assertTrue(static.message.orEmpty().contains("after-observation"))
        assertEquals(0, installer.installed.size)
    }

    @Test
    fun removeAllDetachesEveryHook() {
        hookToString()
        NativeHooks.hook("java.lang.String", "length", "[]", "{}")

        NativeHooks.removeAll()

        assertEquals(0, NativeHooks.installedCount())
        assertTrue(installer.installed.all { it.removed })
    }

    @Test
    fun rewritingHooksProceedWithTheListenersArguments() {
        NativeHooks.hook("java.lang.String", "concat", """["java.lang.String"]""", """{"rewriteArguments":true}""")
        rewriteResponse = """[{"type":"string","value":"rewritten"}]"""
        val chain = FakeChain("a", listOf("b"), "ab")

        installer.installed[0].hook.intercept(chain)

        assertEquals(listOf<Any?>("rewritten"), chain.proceededWith)
        assertFalse(chain.proceeded)
        assertEquals(1, dispatched.size)
    }

    @Test
    fun rewritingHooksProceedNormallyWhenTheListenerReturnsNothing() {
        NativeHooks.hook("java.lang.String", "concat", """["java.lang.String"]""", """{"rewriteArguments":true}""")
        val chain = FakeChain("a", listOf("b"), "ab")

        installer.installed[0].hook.intercept(chain)

        assertTrue(chain.proceeded)
        assertNull(chain.proceededWith)
    }

    @Test
    fun rewritingHooksIgnoreArgumentsThatDoNotMatchTheMethod() {
        NativeHooks.hook("java.lang.String", "concat", """["java.lang.String"]""", """{"rewriteArguments":true}""")
        rewriteResponse = """[{"type":"string","value":"x"},{"type":"string","value":"y"}]"""
        val chain = FakeChain("a", listOf("b"), "ab")

        installer.installed[0].hook.intercept(chain)

        assertTrue(chain.proceeded)
        assertNull(chain.proceededWith)
    }

    @Test
    fun hooksWithoutTheOptionNeverRewriteArguments() {
        NativeHooks.hook("java.lang.String", "concat", """["java.lang.String"]""", "{}")
        rewriteResponse = """[{"type":"string","value":"rewritten"}]"""
        val chain = FakeChain("a", listOf("b"), "ab")

        installer.installed[0].hook.intercept(chain)

        assertTrue(chain.proceeded)
        assertNull(chain.proceededWith)
    }

    @Test(expected = IllegalArgumentException::class)
    fun rewritingArgumentsRequiresABeforeNotification() {
        NativeHooks.hook("java.lang.String", "concat", """["java.lang.String"]""", """{"rewriteArguments":true,"notify":"after"}""")
    }
}
