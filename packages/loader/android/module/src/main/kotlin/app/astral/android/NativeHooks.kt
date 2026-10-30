package app.astral.android

import org.json.JSONArray
import org.json.JSONObject
import java.lang.reflect.Executable
import java.lang.reflect.Method

object NativeHooks {
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

    fun interface ReturnValues {
        fun find(token: String, selfJSON: String, argumentsJSON: String): String?
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
    private var nextToken = 1L

    private var installer: Installer? = null
    private var dispatcher: Dispatcher? = null
    private var returnValues = ReturnValues { token, selfJSON, argumentsJSON ->
        NativeBridge.nativeHookReturnValue(token, selfJSON, argumentsJSON)
    }

    fun useInstaller(value: Installer) {
        synchronized(this) { installer = value }
    }

    fun useDispatcher(value: Dispatcher) {
        synchronized(this) { dispatcher = value }
    }

    fun useReturnValues(value: ReturnValues) {
        synchronized(this) { returnValues = value }
    }

    fun hook(className: String, methodName: String, parametersJSON: String, optionsJSON: String): String {
        val installer = synchronized(this) { installer }
            ?: throw IllegalStateException("The Android hook installer is unavailable")

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
        registration.removable?.remove()
    }

    fun removeAll() {
        val current = synchronized(this) {
            val all = registrations.values.toList()
            registrations.clear()
            all
        }
        for (registration in current) registration.removable?.remove()
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

            val lookup = synchronized(this@NativeHooks) { returnValues }
            val cached = lookup.find(registration.token, selfJSON, argumentsJSON) ?: return chain.proceed()
            val value = runCatching { NativeJava.decode(cached) }.getOrElse {
                Logger.error(LogCategory.HOOKS, "Failed to decode a cached Android hook result", it)
                return chain.proceed()
            }

            return coerceReturn(registration.method, value)
        }
    }

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
            .onFailure { Logger.error(LogCategory.HOOKS, "Failed to dispatch an Android hook event", it) }
    }

    private fun parseToken(tokenJSON: String): String = JSONObject(tokenJSON).getString("id")

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

        throw IllegalArgumentException(
            "No method $methodName${NativeJava.signature(parameters.toTypedArray())} on $className or its superclasses",
        )
    }
}
