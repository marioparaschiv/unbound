package app.unbound.android

import org.json.JSONObject
import org.junit.Assert.assertEquals
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

    private class FakeChain(
        private val self: Any?,
        private val arguments: List<Any?>,
        private val original: Any?,
    ) : NativeHooks.Chain {
        var proceeded = false

        override fun target(): Any? = self
        override fun argument(index: Int): Any? = arguments[index]
        override fun argumentCount(): Int = arguments.size
        override fun proceed(): Any? {
            proceeded = true
            return original
        }
    }

    private lateinit var installer: FakeInstaller
    private val dispatched = ArrayList<Pair<String, String>>()

    @Before
    fun setUp() {
        NativeHooks.removeAll()
        NativeHooks.useLimits(256, 512)
        NativeJava.releaseAll()
        installer = FakeInstaller()
        NativeHooks.useInstaller(installer)
        dispatched.clear()
        NativeHooks.useDispatcher(object : NativeHooks.Dispatcher {
            override fun dispatch(token: String, payloadJSON: String) {
                dispatched.add(token to payloadJSON)
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
        assertThrows(IllegalArgumentException::class.java) {
            NativeHooks.hook("java.lang.Integer", "noSuchMethod", "[]", "{}")
        }

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

    @Test
    fun aReplacingHookReturnsTheCachedResultWithoutCallingTheOriginal() {
        val token = hookToString("""{"replace":true}""")
        val self = """{"type":"int","value":42}"""
        val arguments = "[]"
        NativeHooks.setReturnValue(token, self, arguments, """{"type":"string","value":"cached"}""")

        val chain = FakeChain(42, emptyList(), "original")
        val result = installer.installed[0].hook.intercept(chain)

        assertEquals("cached", result)
        assertEquals(false, chain.proceeded)
    }

    @Test
    fun aCachedResultMatchesAcrossNumericJsonSpelling() {
        val token = hookToString("""{"replace":true}""")
        NativeHooks.setReturnValue(
            token,
            """{"value":42.0,"type":"int"}""",
            """[{"type":"int","value":7.0}]""",
            """{"type":"string","value":"cached"}""",
        )

        val chain = FakeChain(42, listOf(7), "original")

        assertEquals("cached", installer.installed[0].hook.intercept(chain))
    }

    @Test
    fun aCachedResultOnlyAppliesToTheMatchingReceiverAndArguments() {
        val token = hookToString("""{"replace":true}""")
        NativeHooks.setReturnValue(
            token,
            """{"type":"int","value":42}""",
            "[]",
            """{"type":"string","value":"cached"}""",
        )

        val other = FakeChain(7, emptyList(), "original")

        assertEquals("original", installer.installed[0].hook.intercept(other))
        assertTrue(other.proceeded)
    }

    @Test
    fun removingACachedResultRestoresTheOriginal() {
        val token = hookToString("""{"replace":true}""")
        val self = """{"type":"int","value":42}"""
        NativeHooks.setReturnValue(token, self, "[]", """{"type":"string","value":"cached"}""")
        NativeHooks.removeReturnValue(token, self, "[]")

        val chain = FakeChain(42, emptyList(), "original")

        assertEquals("original", installer.installed[0].hook.intercept(chain))
    }

    @Test
    fun clearingCachedResultsRestoresTheOriginal() {
        val token = hookToString("""{"replace":true}""")
        NativeHooks.setReturnValue(
            token,
            """{"type":"int","value":42}""",
            "[]",
            """{"type":"string","value":"cached"}""",
        )
        NativeHooks.clearReturnValues(token)

        val chain = FakeChain(42, emptyList(), "original")

        assertEquals("original", installer.installed[0].hook.intercept(chain))
    }

    @Test
    fun aSilentHookDoesNotNotify() {
        hookToString("""{"notify":false}""")
        installer.installed[0].hook.intercept(FakeChain(42, emptyList(), "original"))

        assertEquals(0, dispatched.size)
    }

    @Test
    fun removingAHookUnregistersItAndItsCachedResults() {
        val token = hookToString("""{"replace":true}""")
        NativeHooks.setReturnValue(
            token,
            """{"type":"int","value":42}""",
            "[]",
            """{"type":"string","value":"cached"}""",
        )

        NativeHooks.remove(token)

        assertEquals(0, NativeHooks.installedCount())
        assertTrue(installer.installed[0].removed)

        val reinstalled = hookToString("""{"replace":true}""")
        val chain = FakeChain(42, emptyList(), "original")

        assertEquals("original", installer.installed[1].hook.intercept(chain))
        assertTrue(JSONObject(reinstalled).getString("id").isNotEmpty())
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
    fun theInjectedLimitsBoundHooksAndCachedResults() {
        NativeHooks.useLimits(1, 1)
        val token = hookToString("""{"replace":true}""")
        NativeHooks.setReturnValue(token, """{"type":"int","value":1}""", "[]", """{"type":"string","value":"a"}""")
        NativeHooks.setReturnValue(token, """{"type":"int","value":1}""", "[]", """{"type":"string","value":"b"}""")

        assertThrows(IllegalArgumentException::class.java) {
            NativeHooks.hook("java.lang.String", "length", "[]", "{}")
        }
        assertThrows(IllegalArgumentException::class.java) {
            NativeHooks.setReturnValue(
                token,
                """{"type":"int","value":2}""",
                "[]",
                """{"type":"string","value":"c"}""",
            )
        }
    }

    @Test
    fun removeAllDetachesEveryHook() {
        hookToString()
        NativeHooks.hook("java.lang.String", "length", "[]", "{}")

        NativeHooks.removeAll()

        assertEquals(0, NativeHooks.installedCount())
        assertTrue(installer.installed.all { it.removed })
    }
}
