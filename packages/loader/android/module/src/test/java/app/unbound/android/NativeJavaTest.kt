package app.unbound.android

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class NativeJavaTest {
    @Before
    fun resetRegistry() {
        NativeJava.releaseAll()
    }

    private fun handleId(response: String): String = JSONObject(response).getString("id")

    private fun value(response: String): JSONObject = JSONObject(response)

    @Test
    fun getClassReturnsAHandleAndReportsItsName() {
        val handle = NativeJava.getClass("java.lang.StringBuilder")

        assertTrue(handleId(handle).isNotEmpty())
        assertEquals("java.lang.Class", value(NativeJava.className(handle)).getString("value"))
    }

    @Test
    fun getClassRejectsAnUnknownClass() {
        assertThrows(IllegalArgumentException::class.java) {
            NativeJava.getClass("com.example.DoesNotExist")
        }
    }

    @Test
    fun constructAndInvokeRoundTripAStringValue() {
        val builder = NativeJava.construct("java.lang.StringBuilder", "[]")
        val argument = """[{"type":"string","value":"unbound"}]"""

        NativeJava.invoke(builder, "append", argument)

        val result = value(NativeJava.invoke(builder, "toString", "[]"))

        assertEquals("string", result.getString("type"))
        assertEquals("unbound", result.getString("value"))
    }

    @Test
    fun argumentsAcceptTheHandleShapeTheBridgeReturns() {
        val element = NativeJava.construct("java.lang.StringBuilder", "[]")
        val list = NativeJava.construct("java.util.ArrayList", "[]")

        NativeJava.invoke(list, "add", "[$element]")

        val stored = value(NativeJava.invoke(list, "get", """[{"type":"int","value":0}]"""))

        assertEquals(handleId(element), stored.getString("value"))
    }

    @Test
    fun invokeReportsTheExceptionTheMethodThrew() {
        val handle = NativeJava.getClass("java.lang.Integer")

        val error = assertThrows(NumberFormatException::class.java) {
            NativeJava.invoke(handle, "parseInt", """[{"type":"string","value":"not a number"}]""")
        }

        assertTrue(error.message.orEmpty().contains("not a number"))
    }

    @Test
    fun invokeResolvesPrimitiveOverloadsByDeclaredType() {
        val builder = NativeJava.construct("java.lang.StringBuilder", "[]")

        NativeJava.invoke(builder, "append", """[{"type":"int","value":7}]""")

        assertEquals("7", value(NativeJava.invoke(builder, "toString", "[]")).getString("value"))
    }

    @Test
    fun invokeReturnsAHandleForANonSerializableResult() {
        val builder = NativeJava.construct("java.lang.StringBuilder", "[]")
        val result = value(NativeJava.invoke(builder, "append", """[{"type":"string","value":"x"}]"""))

        assertEquals("handle", result.getString("type"))
        assertTrue(result.getString("value").isNotEmpty())
    }

    @Test
    fun invokeCallsAStaticMethodOnAClassHandle() {
        val handle = NativeJava.getClass("java.lang.Integer")
        val result = value(
            NativeJava.invoke(handle, "parseInt", """[{"type":"string","value":"42"}]"""),
        )

        assertEquals("int", result.getString("type"))
        assertEquals(42, result.getInt("value"))
    }

    @Test
    fun invokeReachesClassInstanceMethodsOnAClassHandle() {
        val handle = NativeJava.getClass("java.lang.Integer")

        assertEquals(
            "java.lang.Integer",
            value(NativeJava.invoke(handle, "getName", "[]")).getString("value"),
        )
    }

    @Test
    fun invokeRejectsAMethodThatDoesNotExist() {
        val builder = NativeJava.construct("java.lang.StringBuilder", "[]")

        assertThrows(IllegalArgumentException::class.java) {
            NativeJava.invoke(builder, "noSuchMethod", "[]")
        }
    }

    @Test
    fun respondsToDistinguishesPresentAndAbsentMethods() {
        val builder = NativeJava.construct("java.lang.StringBuilder", "[]")

        assertEquals(
            true,
            value(NativeJava.respondsTo(builder, "toString", "[]")).getBoolean("value"),
        )
        assertEquals(
            false,
            value(NativeJava.respondsTo(builder, "noSuchMethod", "[]")).getBoolean("value"),
        )
    }

    @Test
    fun fieldsReadAndWriteThroughReflection() {
        val point = NativeJava.construct(
            "android.graphics.Point",
            """[{"type":"int","value":3},{"type":"int","value":4}]""",
        )

        assertEquals(3, value(NativeJava.getField(point, "x")).getInt("value"))

        NativeJava.setField(point, "x", """{"type":"int","value":9}""")

        assertEquals(9, value(NativeJava.getField(point, "x")).getInt("value"))
    }

    @Test
    fun getFieldRejectsAFieldThatDoesNotExist() {
        val point = NativeJava.construct("android.graphics.Point", "[]")

        assertThrows(IllegalArgumentException::class.java) {
            NativeJava.getField(point, "noSuchField")
        }
    }

    @Test
    fun nullArgumentsSelectTheDeclaredParameterType() {
        val builder = NativeJava.construct("java.lang.StringBuilder", "[]")
        val argument = """[{"type":"null","class":"java.lang.String"}]"""

        NativeJava.invoke(builder, "append", argument)

        assertEquals("null", value(NativeJava.invoke(builder, "toString", "[]")).getString("value"))
    }

    @Test
    fun arrayArgumentsMarshalByComponentType() {
        val handle = NativeJava.getClass("java.lang.String")
        val argument = """[{"type":"array","componentType":"char","value":["a","b","c"]}]"""
        val result = value(NativeJava.invoke(handle, "valueOf", argument))

        assertEquals("abc", result.getString("value"))
    }

    @Test
    fun handlesAreReleasedIndividuallyAndInBulk() {
        val builder = NativeJava.construct("java.lang.StringBuilder", "[]")

        NativeJava.release(builder)

        assertThrows(IllegalArgumentException::class.java) {
            NativeJava.invoke(builder, "toString", "[]")
        }

        val second = NativeJava.construct("java.lang.StringBuilder", "[]")
        NativeJava.releaseAll()

        assertThrows(IllegalArgumentException::class.java) {
            NativeJava.invoke(second, "toString", "[]")
        }
    }

    @Test
    fun handlesAreStableForTheSameObject() {
        val handle = NativeJava.getClass("java.lang.Integer")

        assertEquals(handleId(handle), handleId(NativeJava.getClass("java.lang.Integer")))
        assertNotEquals(handleId(handle), handleId(NativeJava.getClass("java.lang.Long")))
    }

    @Test
    fun invokeRejectsAnUnboundedArgumentCount() {
        val builder = NativeJava.construct("java.lang.StringBuilder", "[]")
        val arguments = (1..64).joinToString(",", "[", "]") { """{"type":"int","value":$it}""" }

        assertThrows(IllegalArgumentException::class.java) {
            NativeJava.invoke(builder, "append", arguments)
        }
    }

    @Test
    fun batchRunsEveryOperationAndReportsResultsInOrder() {
        val builder = NativeJava.construct("java.lang.StringBuilder", "[]")
        val handle = JSONObject(builder)
        val operations = JSONArray()
        operations.put(
            JSONObject()
                .put("op", "invoke")
                .put("handle", handle)
                .put("name", "append")
                .put("args", JSONArray().put(JSONObject().put("type", "string").put("value", "a"))),
        )
        operations.put(JSONObject().put("op", "invoke").put("handle", handle).put("name", "toString"))
        operations.put(
            JSONObject().put("op", "respondsTo").put("handle", handle).put("name", "toString"),
        )

        val results = JSONArray(NativeJava.batch(operations.toString()))

        assertEquals(3, results.length())
        assertEquals("handle", results.getJSONObject(0).getString("type"))
        assertEquals("a", results.getJSONObject(1).getString("value"))
        assertEquals(true, results.getJSONObject(2).getBoolean("value"))
    }

    @Test
    fun batchFailsAtTheFirstFailingOperation() {
        val builder = NativeJava.construct("java.lang.StringBuilder", "[]")
        val handle = JSONObject(builder)
        val operations = JSONArray()
        operations.put(JSONObject().put("op", "invoke").put("handle", handle).put("name", "toString"))
        operations.put(JSONObject().put("op", "invoke").put("handle", handle).put("name", "noSuchMethod"))

        val failure = assertThrows(IllegalStateException::class.java) {
            NativeJava.batch(operations.toString())
        }

        assertTrue(failure.message!!.startsWith("Java batch operation 1 failed"))
    }

    @Test
    fun batchRejectsAnUnsupportedOperation() {
        val builder = NativeJava.construct("java.lang.StringBuilder", "[]")
        val operations = JSONArray().put(
            JSONObject().put("op", "explode").put("handle", JSONObject(builder)).put("name", "x"),
        )

        val failure = assertThrows(IllegalStateException::class.java) {
            NativeJava.batch(operations.toString())
        }

        assertTrue(failure.message!!.contains("explode"))
    }

    @Test
    fun associationsRoundTripAndAreScopedToTheirKey() {
        val builder = NativeJava.construct("java.lang.StringBuilder", "[]")
        val first = NativeJava.createAssociationKey()
        val second = NativeJava.createAssociationKey()

        assertEquals("null", value(NativeJava.getAssociatedObject(builder, first)).getString("type"))

        NativeJava.setAssociatedObject(builder, first, """{"type":"string","value":"kept"}""", 64)

        assertEquals("kept", value(NativeJava.getAssociatedObject(builder, first)).getString("value"))
        assertEquals("null", value(NativeJava.getAssociatedObject(builder, second)).getString("type"))
    }

    @Test
    fun writingANullAssociationRemovesIt() {
        val builder = NativeJava.construct("java.lang.StringBuilder", "[]")
        val key = NativeJava.createAssociationKey()
        NativeJava.setAssociatedObject(builder, key, """{"type":"string","value":"kept"}""", 64)

        NativeJava.setAssociatedObject(builder, key, """{"type":"null"}""", 64)

        assertEquals("null", value(NativeJava.getAssociatedObject(builder, key)).getString("type"))
    }

    @Test
    fun associationKeysAreDistinct() {
        assertNotEquals(
            JSONObject(NativeJava.createAssociationKey()).getString("id"),
            JSONObject(NativeJava.createAssociationKey()).getString("id"),
        )
    }

    @Test
    fun associationsAreBoundedPerObjectButReplaceable() {
        val builder = NativeJava.construct("java.lang.StringBuilder", "[]")
        val first = NativeJava.createAssociationKey()
        val second = NativeJava.createAssociationKey()
        NativeJava.setAssociatedObject(builder, first, """{"type":"string","value":"a"}""", 1)

        NativeJava.setAssociatedObject(builder, first, """{"type":"string","value":"b"}""", 1)

        assertEquals("b", value(NativeJava.getAssociatedObject(builder, first)).getString("value"))
        assertThrows(IllegalArgumentException::class.java) {
            NativeJava.setAssociatedObject(builder, second, """{"type":"string","value":"c"}""", 1)
        }
    }

    @Test
    fun releaseAllForgetsHandlesAndAssociations() {
        val builder = NativeJava.construct("java.lang.StringBuilder", "[]")

        NativeJava.releaseAll()

        assertThrows(IllegalArgumentException::class.java) {
            NativeJava.className(builder)
        }
    }

    @Test
    fun invokeListsTheOverloadsWhenNoneAcceptTheArguments() {
        val builder = NativeJava.construct("java.lang.StringBuilder", "[]")

        val error = assertThrows(IllegalArgumentException::class.java) {
            NativeJava.invoke(builder, "insert", """[{"type":"string","value":"a"},{"type":"string","value":"b"}]""")
        }

        assertTrue(error.message!!.startsWith("No overload of insert on java.lang.StringBuilder accepts these arguments; it has ("))
        assertTrue(error.message!!.contains("(int, "))
    }

    @Test
    fun constructListsTheConstructorsWhenNoneAcceptTheArguments() {
        val error = assertThrows(IllegalArgumentException::class.java) {
            NativeJava.construct("java.lang.StringBuilder", """[{"type":"boolean","value":true},{"type":"boolean","value":false}]""")
        }

        assertTrue(error.message!!.startsWith("No constructor of java.lang.StringBuilder accepts these arguments; it has "))
        assertTrue(error.message!!.contains("(int)"))
    }

    @Test
    fun repeatedCallsKeepChoosingTheOverloadTheirArgumentsMatch() {
        val builder = NativeJava.construct("java.lang.StringBuilder", "[]")
        val text = """[{"type":"string","value":"a"}]"""
        val character = """[{"type":"char","value":"b"}]"""
        val number = """[{"type":"int","value":7}]"""
        val absent = """[{"type":"null","class":"java.lang.CharSequence"}]"""

        repeat(3) {
            NativeJava.invoke(builder, "append", text)
            NativeJava.invoke(builder, "append", character)
            NativeJava.invoke(builder, "append", number)
            NativeJava.invoke(builder, "append", absent)
        }

        assertEquals("ab7nullab7nullab7null", value(NativeJava.invoke(builder, "toString", "[]")).getString("value"))
    }

    @Test
    fun cachedLookupsStillSeparateStaticAndInstanceCalls() {
        val integer = NativeJava.getClass("java.lang.Integer")
        val parse = """[{"type":"string","value":"42"}]"""

        repeat(2) {
            assertEquals(42, value(NativeJava.invoke(integer, "parseInt", parse)).getInt("value"))
            assertEquals("java.lang.Integer", value(NativeJava.invoke(integer, "getName", "[]")).getString("value"))
        }
    }

    @Test
    fun cachedFieldsResolveOnEveryInstance() {
        val first = NativeJava.construct("java.awt.Point", """[{"type":"int","value":1},{"type":"int","value":2}]""")
        val second = NativeJava.construct("java.awt.Point", """[{"type":"int","value":3},{"type":"int","value":4}]""")

        assertEquals(1, value(NativeJava.getField(first, "x")).getInt("value"))
        assertEquals(3, value(NativeJava.getField(second, "x")).getInt("value"))
        NativeJava.setField(second, "x", """{"type":"int","value":9}""")
        assertEquals(9, value(NativeJava.getField(second, "x")).getInt("value"))
        assertEquals(1, value(NativeJava.getField(first, "x")).getInt("value"))
    }

    @Test
    fun aHandleIsReleasedOnlyOnceEveryIssueOfItIs() {
        val list = NativeJava.construct("java.util.ArrayList", "[]")
        val id = handleId(list)
        val again = value(NativeJava.invoke(list, "subList", """[{"type":"int","value":0},{"type":"int","value":0}]"""))
        val self = value(NativeJava.invoke(NativeJava.getClass("java.util.Objects"), "requireNonNull", "[$list]"))
        assertEquals(id, self.getString("value"))
        assertNotEquals(id, again.getString("value"))
        val before = NativeJava.liveHandles()

        NativeJava.release("""{"id":"$id","issues":1}""")
        assertEquals(before, NativeJava.liveHandles())

        NativeJava.release("""{"id":"$id","issues":1}""")
        assertEquals(before - 1, NativeJava.liveHandles())
        assertThrows(IllegalArgumentException::class.java) { NativeJava.invoke(list, "size", "[]") }
    }

    @Test
    fun aReleaseWithoutIssuesStillDropsTheHandle() {
        val list = NativeJava.construct("java.util.ArrayList", "[]")
        NativeJava.invoke(NativeJava.getClass("java.util.Objects"), "requireNonNull", "[$list]")

        NativeJava.release(list)

        assertThrows(IllegalArgumentException::class.java) { NativeJava.invoke(list, "size", "[]") }
    }

    @Test
    fun aFailedBatchReleasesTheHandlesItAlreadyIssued() {
        val builder = NativeJava.construct("java.lang.StringBuilder", "[]")
        val before = NativeJava.liveHandles()
        val steps = """[
            {"op":"invoke","handle":$builder,"name":"reverse","args":[]},
            {"op":"invoke","handle":$builder,"name":"doesNotExist","args":[]}
        ]"""

        assertThrows(IllegalStateException::class.java) { NativeJava.batch(steps) }
        assertEquals(before, NativeJava.liveHandles())

        NativeJava.release("""{"id":"${handleId(builder)}","issues":1}""")
        assertEquals(before - 1, NativeJava.liveHandles())
    }
}
