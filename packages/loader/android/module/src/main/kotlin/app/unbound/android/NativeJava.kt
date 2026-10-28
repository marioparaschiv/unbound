package app.unbound.android

import org.json.JSONArray
import org.json.JSONObject
import java.lang.reflect.Field
import java.lang.reflect.Method
import java.lang.reflect.Modifier

object NativeJava {
    private const val MAX_RESULT_STRING_LENGTH = 1 shl 20
    private const val MAX_LISTED_OVERLOADS = 6

    private val associations = java.util.WeakHashMap<Any, HashMap<String, Any?>>()
    private var nextAssociation = 1L
    private val objectsByHandle = HashMap<String, Any>()
    private val handlesByIdentity = HashMap<IdentityKey, String>()
    private val issuesByHandle = HashMap<String, Long>()
    private var nextHandle = 1L

    private class IdentityKey(val target: Any) {
        override fun hashCode(): Int = System.identityHashCode(target)
        override fun equals(other: Any?): Boolean = other is IdentityKey && other.target === target
    }

    private var pluginClassLoader: ClassLoader? = null

    private val methodsByName = java.util.concurrent.ConcurrentHashMap<Class<*>, Map<String, List<Method>>>()
    private val resolvedMethods = java.util.concurrent.ConcurrentHashMap<MethodKey, Method>()
    private val resolvedFields = java.util.concurrent.ConcurrentHashMap<Pair<Class<*>, String>, Field>()

    private data class MethodKey(val owner: Class<*>, val static: Boolean, val name: String, val arguments: List<String>)

    fun useClassLoader(classLoader: ClassLoader) {
        synchronized(this) { pluginClassLoader = classLoader }
    }

    fun getClass(name: String): String {
        val target = loadClass(name)
        return JSONObject().put("id", handle(target)).toString()
    }

    fun className(handleJSON: String): String {
        val target = resolve(parseHandle(handleJSON))
        return serialize(target.javaClass.name)
    }

    fun describe(name: String): String {
        val target = loadClass(name)
        val description = JSONObject()
            .put("name", target.name)
            .put("superclass", target.superclass?.name ?: JSONObject.NULL)
            .put("interfaces", JSONArray(target.interfaces.map { it.name }))
            .put(
                "constructors",
                JSONArray(target.declaredConstructors.map { constructor -> JSONArray(constructor.parameterTypes.map { it.name }) }),
            )
            .put(
                "methods",
                JSONArray(
                    target.declaredMethods.map { method ->
                        JSONObject()
                            .put("name", method.name)
                            .put("parameters", JSONArray(method.parameterTypes.map { it.name }))
                            .put("returnType", method.returnType.name)
                            .put("static", Modifier.isStatic(method.modifiers))
                    },
                ),
            )
            .put(
                "fields",
                JSONArray(
                    target.declaredFields.map { field ->
                        JSONObject()
                            .put("name", field.name)
                            .put("type", field.type.name)
                            .put("static", Modifier.isStatic(field.modifiers))
                    },
                ),
            )
        return description.toString()
    }

    fun construct(name: String, argumentsJSON: String): String {
        val target = loadClass(name)
        val arguments = parseArguments(argumentsJSON)
        val constructor = target.declaredConstructors
            .filter { it.parameterCount == arguments.size }
            .firstOrNull { matches(it.parameterTypes, arguments) }
            ?: throw IllegalArgumentException(
                "No constructor of $name accepts these arguments; it has ${signatures(
                    target.declaredConstructors.map {
                        it.parameterTypes
                    },
                )}",
            )

        constructor.isAccessible = true
        val instance = rethrowingCause { constructor.newInstance(*values(constructor.parameterTypes, arguments)) }
            ?: throw IllegalStateException("Constructing $name produced no instance")

        return JSONObject().put("id", handle(instance)).toString()
    }

    fun respondsTo(handleJSON: String, name: String, argumentsJSON: String): String {
        val target = resolve(parseHandle(handleJSON))
        val arguments = parseArguments(argumentsJSON)
        val found = runCatching { findMethod(target, name, arguments) }.isSuccess
        return serialize(found)
    }

    fun invoke(handleJSON: String, name: String, argumentsJSON: String): String {
        val target = resolve(parseHandle(handleJSON))
        val arguments = parseArguments(argumentsJSON)
        val method = findMethod(target, name, arguments)
        val receiver = if (Modifier.isStatic(method.modifiers)) null else target

        if (receiver == null && target !is Class<*>) {
            throw IllegalArgumentException("$name is static but was called on an instance")
        }

        method.isAccessible = true
        return serialize(rethrowingCause { method.invoke(receiver, *values(method.parameterTypes, arguments)) })
    }

    fun getField(handleJSON: String, name: String): String {
        val target = resolve(parseHandle(handleJSON))
        val field = findField(target, name)
        field.isAccessible = true
        return serialize(field.get(if (Modifier.isStatic(field.modifiers)) null else target))
    }

    fun setField(handleJSON: String, name: String, valueJSON: String) {
        val target = resolve(parseHandle(handleJSON))
        val field = findField(target, name)
        field.isAccessible = true
        val argument = parseValue(JSONObject(valueJSON))
        field.set(
            if (Modifier.isStatic(field.modifiers)) null else target,
            value(field.type, argument),
        )
    }

    fun batch(operationsJSON: String): String {
        val operations = JSONArray(operationsJSON)
        val results = JSONArray()
        for (index in 0 until operations.length()) {
            val operation = operations.getJSONObject(index)
            val kind = operation.optString("op")
            val handle = operation.getJSONObject("handle").toString()
            val name = operation.getString("name")

            val outcome = runCatching {
                when (kind) {
                    "invoke" -> invoke(handle, name, operation.optJSONArray("args")?.toString() ?: "[]")

                    "getField" -> getField(handle, name)

                    "setField" -> {
                        setField(handle, name, operation.getJSONObject("value").toString())
                        serialize(null)
                    }

                    "respondsTo" ->
                        respondsTo(handle, name, operation.optJSONArray("args")?.toString() ?: "[]")

                    else -> throw IllegalArgumentException("Unsupported Java batch operation: $kind")
                }
            }

            val result = outcome.getOrElse {
                throw IllegalStateException(
                    "Java batch operation $index failed: ${it.message ?: it.toString()}",
                    it,
                )
            }
            results.put(JSONObject(result))
        }

        return results.toString()
    }

    fun createAssociationKey(): String {
        val id = synchronized(this) { "assoc-${nextAssociation++}" }

        return JSONObject().put("id", id).toString()
    }

    fun setAssociatedObject(handleJSON: String, keyJSON: String, valueJSON: String, maximumPerObject: Int) {
        val target = resolve(parseHandle(handleJSON))
        val key = parseHandle(keyJSON)
        val value = decode(valueJSON)

        synchronized(this) {
            val bucket = associations.getOrPut(target) { HashMap() }
            if (value == null) {
                bucket.remove(key)
                return
            }
            require(bucket.containsKey(key) || bucket.size < maximumPerObject) {
                "Too many Java associations on one object"
            }
            bucket[key] = value
        }
    }

    fun getAssociatedObject(handleJSON: String, keyJSON: String): String {
        val target = resolve(parseHandle(handleJSON))
        val key = parseHandle(keyJSON)
        val value = synchronized(this) { associations[target]?.get(key) }

        return serialize(value)
    }

    fun release(handleJSON: String) {
        val request = JSONObject(handleJSON)
        val id = request.getString("id")
        val released = request.optLong("issues", -1L)
        synchronized(this) {
            val remaining = if (released < 0) 0L else (issuesByHandle[id] ?: 0L) - released
            if (remaining > 0) {
                issuesByHandle[id] = remaining
                return
            }
            issuesByHandle.remove(id)
            val target = objectsByHandle.remove(id) ?: return
            handlesByIdentity.remove(IdentityKey(target))
        }
    }

    fun liveHandles(): Int = synchronized(this) { objectsByHandle.size }

    fun releaseAll() {
        synchronized(this) {
            objectsByHandle.clear()
            handlesByIdentity.clear()
            issuesByHandle.clear()
            associations.clear()
            nextHandle = 1L
            nextAssociation = 1L
        }
    }

    fun loadHostClass(name: String): Class<*> = loadClass(name)

    fun resolveType(name: String): Class<*> = primitive(name) ?: loadClass(name)

    fun describe(value: Any?): String = serialize(value)

    fun describeAll(values: List<Any?>): String =
        values.joinToString(",", "[", "]") { serialize(it) }

    fun decode(valueJSON: String): Any? = when (val argument = parseValue(JSONObject(valueJSON))) {
        is Absent -> null
        is Reference -> argument.target
        is Scalar -> argument.value
    }

    fun coerceTo(type: Class<*>, value: Any?): Any? = coerce(type, value)

    private fun loadClass(name: String): Class<*> {
        val loaders = listOfNotNull(pluginClassLoader, NativeJava::class.java.classLoader)
        for (loader in loaders) {
            runCatching { return Class.forName(name, false, loader) }
        }

        throw IllegalArgumentException("The Java class $name is unavailable")
    }

    fun signature(types: Array<Class<*>>): String = types.joinToString(", ", "(", ")") { it.name }

    private fun signatures(overloads: List<Array<Class<*>>>): String =
        overloads.take(MAX_LISTED_OVERLOADS).joinToString(" ") { signature(it) } +
            if (overloads.size > MAX_LISTED_OVERLOADS) " and ${overloads.size - MAX_LISTED_OVERLOADS} more" else ""

    private fun findMethod(target: Any, name: String, arguments: List<Argument>): Method {
        val owner = if (target is Class<*>) target else target.javaClass
        val key = MethodKey(owner, target is Class<*>, name, arguments.map(::argumentKey))
        resolvedMethods[key]?.let { return it }

        val searched = if (target is Class<*>) listOf(owner, Class::class.java) else listOf(owner)
        val candidates = searched
            .flatMap { methodsNamed(it, name) }
            .filter { it.parameterCount == arguments.size }
        require(candidates.isNotEmpty()) { "No method $name on ${owner.name} takes ${arguments.size} arguments" }

        val method = candidates.filter { matches(it.parameterTypes, arguments) }
            .minByOrNull { specificity(it.parameterTypes, arguments) }
            ?: throw IllegalArgumentException(
                "No overload of $name on ${owner.name} accepts these arguments; it has ${signatures(candidates.map { it.parameterTypes })}",
            )
        method.isAccessible = true
        resolvedMethods[key] = method
        return method
    }

    private fun argumentKey(argument: Argument): String = when (argument) {
        is Absent -> "null:${argument.declaredType?.name}"
        is Reference -> "object:${argument.target.javaClass.name}"
        is Scalar -> "value:${argument.declaredType?.name}:${argument.value?.javaClass?.name}"
    }

    private fun methodsNamed(owner: Class<*>, name: String): List<Method> =
        methodsByName.getOrPut(owner) { methods(owner).groupBy { it.name } }[name].orEmpty()

    private fun methods(owner: Class<*>): List<Method> {
        val collected = ArrayList<Method>()
        var current: Class<*>? = owner
        while (current != null) {
            collected.addAll(current.declaredMethods)
            current = current.superclass
        }
        collected.addAll(owner.methods)
        return collected
    }

    private fun findField(target: Any, name: String): Field {
        val owner = if (target is Class<*>) target else target.javaClass
        return resolvedFields.getOrPut(owner to name) {
            declaredField(owner, name).also { it.isAccessible = true }
        }
    }

    private fun declaredField(owner: Class<*>, name: String): Field {
        var current: Class<*>? = owner
        while (current != null) {
            runCatching { return current!!.getDeclaredField(name) }
            current = current.superclass
        }

        throw IllegalArgumentException("No field $name on ${owner.name}")
    }

    private sealed interface Argument {
        val declaredType: Class<*>?
    }

    private class Scalar(val value: Any?, override val declaredType: Class<*>?) : Argument

    private class Reference(val target: Any) : Argument {
        override val declaredType: Class<*>? = null
    }

    private class Absent(override val declaredType: Class<*>?) : Argument

    private fun parseArguments(argumentsJSON: String): List<Argument> {
        val array = JSONArray(argumentsJSON)
        return (0 until array.length()).map { parseValue(array.getJSONObject(it)) }
    }

    private fun parseValue(value: JSONObject): Argument {
        val type = value.optString("type")
        if (type.isEmpty() && value.has("id")) {
            return Reference(resolve(value.getString("id")))
        }
        require(type.isNotEmpty()) { "The Java value has no type" }

        return when (type) {
            "null" -> Absent(value.optString("class").takeIf { it.isNotEmpty() }?.let { loadClass(it) })

            "handle" -> Reference(resolve(value.getString("value")))

            "string" -> Scalar(value.optString("value"), String::class.java)

            "boolean" -> Scalar(value.getBoolean("value"), java.lang.Boolean.TYPE)

            "byte" -> Scalar(boundedLong(value).toByte(), java.lang.Byte.TYPE)

            "short" -> Scalar(boundedLong(value).toShort(), java.lang.Short.TYPE)

            "char" -> {
                val text = value.optString("value")
                require(text.length == 1) { "The Java char value must be one character" }
                Scalar(text[0], Character.TYPE)
            }

            "int" -> Scalar(boundedLong(value).toInt(), Integer.TYPE)

            "long" -> Scalar(boundedLong(value), java.lang.Long.TYPE)

            "float" -> Scalar(boundedDouble(value).toFloat(), java.lang.Float.TYPE)

            "double" -> Scalar(boundedDouble(value), java.lang.Double.TYPE)

            "array" -> parseArray(value)

            else -> throw IllegalArgumentException("Unsupported Java value type: $type")
        }
    }

    private fun parseArray(value: JSONObject): Argument {
        val componentName = value.optString("componentType")
        require(componentName.isNotEmpty()) { "The Java array has no component type" }
        val elements = value.optJSONArray("value") ?: JSONArray()

        val component = primitive(componentName) ?: loadClass(componentName)
        val array = java.lang.reflect.Array.newInstance(component, elements.length())

        for (index in 0 until elements.length()) {
            val element = elements.get(index)
            val converted = when {
                element is JSONObject -> value(component, parseValue(element))
                component == Character.TYPE -> (element as String)[0]
                else -> value(component, Scalar(element, component))
            }
            java.lang.reflect.Array.set(array, index, converted)
        }

        return Scalar(array, array.javaClass)
    }

    private fun primitive(name: String): Class<*>? = when (name) {
        "boolean" -> java.lang.Boolean.TYPE
        "byte" -> java.lang.Byte.TYPE
        "short" -> java.lang.Short.TYPE
        "char" -> Character.TYPE
        "int" -> Integer.TYPE
        "long" -> java.lang.Long.TYPE
        "float" -> java.lang.Float.TYPE
        "double" -> java.lang.Double.TYPE
        else -> null
    }

    private fun boundedLong(value: JSONObject): Long {
        val number = value.optLong("value", Long.MIN_VALUE)
        require(number != Long.MIN_VALUE || value.optString("value") == Long.MIN_VALUE.toString()) {
            "The Java integer value is out of bounds"
        }
        return number
    }

    private fun boundedDouble(value: JSONObject): Double {
        val number = value.optDouble("value", Double.NaN)
        require(number.isFinite()) { "The Java decimal value is out of bounds" }
        return number
    }

    private fun specificity(parameters: Array<Class<*>>, arguments: List<Argument>): Int =
        parameters.indices.sumOf { distance(parameters[it], arguments[it]) }

    private fun distance(parameter: Class<*>, argument: Argument): Int {
        val actual = actualType(argument) ?: return if (parameter == Any::class.java) 100 else 1
        if (parameter == actual) return 0
        if (parameter == Any::class.java) return 100
        if (parameter.isPrimitive || actual.isPrimitive) return 2

        var hops = 0
        var current: Class<*>? = actual
        while (current != null && current != parameter) {
            hops++
            current = current.superclass
        }

        return if (current == parameter) hops else 50
    }

    private fun actualType(argument: Argument): Class<*>? = when (argument) {
        is Absent -> argument.declaredType
        is Reference -> argument.target.javaClass
        is Scalar -> argument.declaredType
    }

    private fun matches(parameters: Array<Class<*>>, arguments: List<Argument>): Boolean {
        if (parameters.size != arguments.size) return false
        return parameters.indices.all { accepts(parameters[it], arguments[it]) }
    }

    private fun accepts(parameter: Class<*>, argument: Argument): Boolean = when (argument) {
        is Absent ->
            !parameter.isPrimitive &&
                (argument.declaredType == null || parameter.isAssignableFrom(argument.declaredType))

        is Reference -> parameter.isInstance(argument.target) ||
            (parameter == Class::class.java && argument.target is Class<*>)

        is Scalar -> acceptsScalar(parameter, argument.value)
    }

    private fun acceptsScalar(parameter: Class<*>, value: Any?): Boolean {
        if (value == null) return !parameter.isPrimitive
        if (parameter.isInstance(value)) return true

        return when (parameter) {
            java.lang.Boolean.TYPE -> value is Boolean
            java.lang.Byte.TYPE -> value is Byte
            java.lang.Short.TYPE -> value is Short || value is Byte
            Character.TYPE -> value is Char
            Integer.TYPE -> value is Int || value is Short || value is Byte
            java.lang.Long.TYPE -> value is Long || value is Int || value is Short || value is Byte
            java.lang.Float.TYPE -> value is Float || value is Long || value is Int
            java.lang.Double.TYPE -> value is Double || value is Float || value is Long || value is Int
            else -> false
        }
    }

    private fun values(parameters: Array<Class<*>>, arguments: List<Argument>): Array<Any?> =
        Array(parameters.size) { value(parameters[it], arguments[it]) }

    private fun value(parameter: Class<*>, argument: Argument): Any? = when (argument) {
        is Absent -> null
        is Reference -> argument.target
        is Scalar -> coerce(parameter, argument.value)
    }

    private fun coerce(parameter: Class<*>, value: Any?): Any? {
        if (value !is Number) return value

        return when (parameter) {
            java.lang.Byte.TYPE, java.lang.Byte::class.java -> value.toByte()
            java.lang.Short.TYPE, java.lang.Short::class.java -> value.toShort()
            Integer.TYPE, Integer::class.java -> value.toInt()
            java.lang.Long.TYPE, java.lang.Long::class.java -> value.toLong()
            java.lang.Float.TYPE, java.lang.Float::class.java -> value.toFloat()
            java.lang.Double.TYPE, java.lang.Double::class.java -> value.toDouble()
            else -> value
        }
    }

    private fun serialize(result: Any?): String = when (result) {
        null -> JSONObject().put("type", "null").put("value", JSONObject.NULL).toString()
        is Boolean -> tagged("boolean", result)
        is Byte -> tagged("byte", result.toInt())
        is Short -> tagged("short", result.toInt())
        is Char -> tagged("char", result.toString())
        is Int -> tagged("int", result)
        is Long -> tagged("long", result)
        is Float -> tagged("float", result.toDouble())
        is Double -> tagged("double", result)
        is String -> tagged("string", result.take(MAX_RESULT_STRING_LENGTH))
        else -> tagged("handle", handle(result))
    }

    private inline fun <T> rethrowingCause(call: () -> T): T = try {
        call()
    } catch (error: java.lang.reflect.InvocationTargetException) {
        throw error.targetException ?: error
    }

    fun handleFor(target: Any): String = JSONObject().put("id", handle(target)).toString()

    fun isJavaHandle(handleJSON: String): Boolean = runCatching {
        val value = JSONObject(handleJSON)
        val id = value.optString("id").ifEmpty { value.optString("value") }
        id.startsWith("java-")
    }.getOrDefault(false)

    fun objectForHandle(handleJSON: String): Any {
        val value = JSONObject(handleJSON)
        val id = value.optString("id").ifEmpty { value.optString("value") }
        return resolve(id)
    }

    private fun tagged(type: String, value: Any): String =
        JSONObject().put("type", type).put("value", value).toString()

    private fun resolve(id: String): Any = synchronized(this) {
        objectsByHandle[id] ?: throw IllegalArgumentException("The Java handle is unavailable")
    }

    private fun parseHandle(handleJSON: String): String = JSONObject(handleJSON).getString("id")

    private fun handle(target: Any): String = synchronized(this) {
        val key = IdentityKey(target)
        val id = handlesByIdentity[key] ?: "java-${nextHandle++}".also {
            objectsByHandle[it] = target
            handlesByIdentity[key] = it
        }
        issuesByHandle[id] = (issuesByHandle[id] ?: 0L) + 1
        return id
    }
}
