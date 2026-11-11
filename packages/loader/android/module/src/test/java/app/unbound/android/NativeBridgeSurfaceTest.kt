package app.unbound.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.lang.reflect.Method
import java.lang.reflect.Modifier

/** Checks JniSurface.h against NativeBridge, so a renamed or retyped crossing fails here instead of at library load. */
class NativeBridgeSurfaceTest {
    private data class Entry(val name: String, val signature: String)

    private val source: String by lazy {
        File(System.getProperty("unbound.jniSurface") ?: "src/main/cpp/JniSurface.h")
            .readText()
            .replace("\\\n", "\n")
            .replace("UNBOUND_JNI_STRING", "\"Ljava/lang/String;\"")
            .replace(Regex("\"\\s*\""), "")
    }

    private fun table(macro: String, entry: Regex): List<Entry> {
        val start = source.indexOf("#define $macro(X)")
        assertTrue("JniSurface.h no longer defines $macro", start != -1)
        val end = source.indexOf("#define", start + 1).takeIf { it != -1 } ?: source.length
        return entry.findAll(source.substring(start, end)).map { Entry(it.groupValues[1], it.groupValues[2]) }.toList()
    }

    private val callbacks by lazy { table("UNBOUND_BRIDGE_CALLBACKS", Regex("""X\(\w+,\s*"([^"]+)",\s*"([^"]+)"\)""")) }
    private val natives by lazy { table("UNBOUND_BRIDGE_NATIVES", Regex("""X\("([^"]+)",\s*"([^"]+)",\s*\w+\)""")) }

    private val methods: Map<String, List<Method>> by lazy { NativeBridge::class.java.declaredMethods.groupBy { it.name } }

    private fun descriptor(type: Class<*>): String =
        when {
            type.isArray -> "[" + descriptor(type.componentType!!)
            type == Void.TYPE -> "V"
            type == java.lang.Boolean.TYPE -> "Z"
            type == java.lang.Byte.TYPE -> "B"
            type == java.lang.Character.TYPE -> "C"
            type == java.lang.Short.TYPE -> "S"
            type == java.lang.Integer.TYPE -> "I"
            type == java.lang.Long.TYPE -> "J"
            type == java.lang.Float.TYPE -> "F"
            type == java.lang.Double.TYPE -> "D"
            else -> "L" + type.name.replace('.', '/') + ";"
        }

    private fun descriptor(method: Method): String =
        method.parameterTypes.joinToString("", "(", ")") { descriptor(it) } + descriptor(method.returnType)

    private fun staticMethod(entry: Entry): Method? =
        methods[entry.name].orEmpty().firstOrNull { Modifier.isStatic(it.modifiers) && descriptor(it) == entry.signature }

    @Test
    fun everyCallbackIsAStaticMethodWithItsSignature() {
        assertTrue(callbacks.isNotEmpty())
        for (entry in callbacks) {
            val method = staticMethod(entry)
            assertTrue(
                "NativeBridge.${entry.name}${entry.signature} is not a static method; found " +
                    methods[entry.name].orEmpty().map { descriptor(it) },
                method != null && !Modifier.isNative(method.modifiers),
            )
        }
    }

    @Test
    fun everyNativeIsAStaticExternalWithItsSignature() {
        assertTrue(natives.isNotEmpty())
        for (entry in natives) {
            val method = staticMethod(entry)
            assertTrue(
                "NativeBridge.${entry.name}${entry.signature} is not a static external; found " +
                    methods[entry.name].orEmpty().map { descriptor(it) to Modifier.isStatic(it.modifiers) },
                method != null && Modifier.isNative(method.modifiers),
            )
        }
    }

    @Test
    fun everyExternalIsRegistered() {
        val registered = natives.map { it.name }.toSet()
        val externals = methods.values.flatten().filter { Modifier.isNative(it.modifiers) }.map { it.name }.toSet()
        assertEquals(emptySet<String>(), externals - registered)
    }

    @Test
    fun eachNameIsDeclaredOnce() {
        for (names in listOf(callbacks.map { it.name }, natives.map { it.name })) {
            assertEquals(names.size, names.toSet().size)
        }
    }
}
