package app.unbound.android

import org.json.JSONArray
import org.json.JSONObject
import java.lang.reflect.Executable
import java.lang.reflect.Method

object NativeHooks {
    private const val MAX_HOOKS = 256
    private const val MAX_CACHED_RETURNS = 512

    interface Installer {
        fun install(method: Executable, hook: Hook): Removable
    }

    interface Removable {
        fun remove()
    }

    interface Chain {
        fun target(): Any?
        fun argument(index: Int): Any?
        fun argumentCount(): Int
        fun proceed(): Any?
    }

    interface Hook {
        fun intercept(chain: Chain): Any?
    }

    interface Dispatcher {
        fun dispatch(token: String, payloadJSON: String)
    }

    private class Registration(
        val token: String,
        val method: Executable,
        val receiver: Class<*>?,
        val replaces: Boolean,
        val notifies: Boolean,
        var removable: Removable?,
    )

    private val registrations = HashMap<String, Registration>()
    private val returnValues = HashMap<String, Any?>()
    private var nextToken = 1L

    private var installer: Installer? = null
    private var dispatcher: Dispatcher? = null

    fun useInstaller(value: Installer) {
        synchronized(this) { installer = value }
    }

    fun useDispatcher(value: Dispatcher) {
        synchronized(this) { dispatcher = value }
    }

    fun hook(className: String, methodName: String, parametersJSON: String, optionsJSON: String): String {
        val installer = synchronized(this) { installer }
            ?: throw IllegalStateException("The Android hook installer is unavailable")

        synchronized(this) {
            require(registrations.size < MAX_HOOKS) { "Too many Android hooks are installed" }
        }

        val options = JSONObject(optionsJSON)
        val owner = NativeJava.loadHostClass(className)
        val method = resolveMethod(className, methodName, parametersJSON)
        val token = synchronized(this) { "hook-${nextToken++}" }
        val registration = Registration(
            token,
            method,
            owner.takeIf { method.declaringClass != it },
            options.optBoolean("replace", false),
            options.optBoolean("notify", true),
            null,
        )

        synchronized(this) { registrations[token] = registration }

        val removable = runCatching { installer.install(method, interceptor(registration)) }
            .onFailure { synchronized(this) { registrations.remove(token) } }
            .getOrThrow()

        synchronized(this) { registration.removable = removable }

        return JSONObject().put("id", token).toString()
    }

    fun remove(tokenJSON: String) {
        val token = parseToken(tokenJSON)
        val registration = synchronized(this) { registrations.remove(token) } ?: return
        synchronized(this) { returnValues.keys.removeAll { it.startsWith("$token|") } }
        registration.removable?.remove()
    }

    fun removeAll() {
        val current = synchronized(this) {
            val all = registrations.values.toList()
            registrations.clear()
            returnValues.clear()
            all
        }
        for (registration in current) registration.removable?.remove()
    }

    fun setReturnValue(tokenJSON: String, selfJSON: String, argumentsJSON: String, valueJSON: String) {
        val key = cacheKey(parseToken(tokenJSON), selfJSON, argumentsJSON)
        synchronized(this) {
            require(returnValues.size < MAX_CACHED_RETURNS) { "Too many cached Android hook results" }
            returnValues[key] = NativeJava.decode(valueJSON)
        }
    }

    fun removeReturnValue(tokenJSON: String, selfJSON: String, argumentsJSON: String) {
        val key = cacheKey(parseToken(tokenJSON), selfJSON, argumentsJSON)
        synchronized(this) { returnValues.remove(key) }
    }

    fun clearReturnValues(tokenJSON: String) {
        val token = parseToken(tokenJSON)
        synchronized(this) { returnValues.keys.removeAll { it.startsWith("$token|") } }
    }

    fun installedCount(): Int = synchronized(this) { registrations.size }

    private fun interceptor(registration: Registration): Hook = object : Hook {
        override fun intercept(chain: Chain): Any? {
            val self = chain.target()
            if (registration.receiver?.isInstance(self) == false) return chain.proceed()

            val arguments = (0 until chain.argumentCount()).map { chain.argument(it) }
            val selfJSON = NativeJava.describe(self)
            val argumentsJSON = NativeJava.describeAll(arguments)

            if (registration.notifies) {
                notify(registration.token, selfJSON, argumentsJSON)
            }

            if (!registration.replaces) return chain.proceed()

            val key = cacheKey(registration.token, selfJSON, argumentsJSON)
            val cached = synchronized(this@NativeHooks) {
                if (returnValues.containsKey(key)) returnValues[key] else NO_VALUE
            }

            if (cached === NO_VALUE) return chain.proceed()

            return coerceReturn(registration.method, cached)
        }
    }

    private val NO_VALUE = Any()

    private fun coerceReturn(method: Executable, value: Any?): Any? {
        if (method !is Method) return value
        return NativeJava.coerceTo(method.returnType, value)
    }

    private fun notify(token: String, selfJSON: String, argumentsJSON: String) {
        val target = synchronized(this) { dispatcher } ?: return
        val payload = JSONObject()
            .put("self", JSONObject(selfJSON))
            .put("args", JSONArray(argumentsJSON))
        runCatching { target.dispatch(token, payload.toString()) }
            .onFailure { Logger.error("hooks", "Failed to dispatch an Android hook event", it) }
    }

    private fun cacheKey(token: String, selfJSON: String, argumentsJSON: String): String =
        "$token|${canonical(selfJSON)}|${canonical(argumentsJSON)}"

    fun canonical(json: String): String {
        val trimmed = json.trim()
        val parsed = runCatching {
            if (trimmed.startsWith("[")) JSONArray(trimmed) else JSONObject(trimmed)
        }.getOrNull() ?: return trimmed

        return canonicalValue(parsed)
    }

    private fun canonicalValue(value: Any?): String = when (value) {
        null, JSONObject.NULL -> "null"
        is JSONObject -> value.keys().asSequence().sorted()
            .joinToString(",", "{", "}") { "\"$it\":${canonicalValue(value.get(it))}" }
        is JSONArray -> (0 until value.length())
            .joinToString(",", "[", "]") { canonicalValue(value.get(it)) }
        is Number -> canonicalNumber(value)
        is String -> JSONObject.quote(value)
        else -> value.toString()
    }

    private fun canonicalNumber(value: Number): String {
        val decimal = value.toDouble()
        if (decimal.isFinite() && decimal == Math.floor(decimal) && Math.abs(decimal) < 1e15) {
            return decimal.toLong().toString()
        }

        return decimal.toString()
    }

    private fun parseToken(tokenJSON: String): String {
        val id = JSONObject(tokenJSON).optString("id").trim()
        require(id.isNotEmpty() && id.length <= 128) { "The Android hook token is out of bounds" }
        return id
    }

    private fun resolveMethod(className: String, methodName: String, parametersJSON: String): Executable {
        val owner = NativeJava.loadHostClass(className)
        val names = JSONArray(parametersJSON)
        val parameters = (0 until names.length()).map { NativeJava.resolveType(names.getString(it)) }

        if (methodName == "<init>") {
            return owner.getDeclaredConstructor(*parameters.toTypedArray())
                .apply { isAccessible = true }
        }

        var current: Class<*>? = owner
        while (current != null) {
            runCatching {
                return current!!.getDeclaredMethod(methodName, *parameters.toTypedArray())
                    .apply { isAccessible = true }
            }
            current = current.superclass
        }

        throw IllegalArgumentException("No method $methodName on $className takes those parameters")
    }
}
