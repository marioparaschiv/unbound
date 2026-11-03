package app.unbound.android

import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener
import java.lang.reflect.Executable
import java.lang.reflect.Method
import java.lang.reflect.Modifier

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

    private enum class HookPhase(val wireName: String) {
        BEFORE("before"),
        AFTER("after"),
    }

    private data class PayloadSelection(val receiver: Boolean, val arguments: List<Int>?, val phase: HookPhase)

    private data class Description(val receiver: String?, val arguments: String, val issued: List<String>)

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
        val payload: PayloadSelection,
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
        val notify = options.opt("notify")
        val payload = payloadSelection(
            options,
            method.parameterCount,
            if (notify == "after") HookPhase.AFTER else HookPhase.BEFORE,
        )
        val coalesceValue = options.opt("coalesce")
        val coalesce = coalesceValue != null && coalesceValue != JSONObject.NULL
        require(!coalesce || coalesceValue == "receiver") {
            "The hook coalescing policy is unsupported"
        }
        require(
            !coalesce ||
                (
                    notify != false && !options.optBoolean("replace", false) &&
                        !Modifier.isStatic(method.modifiers) && payload.receiver &&
                        payload.phase == HookPhase.AFTER
                    ),
        ) {
            "Receiver coalescing requires a non-replacing after-observation hook with its receiver"
        }
        val registration = Registration(
            token,
            method,
            owner.takeIf { method.declaringClass != it },
            options.optBoolean("replace", false),
            notify != false,
            payload,
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
            val cacheDescription = if (registration.replaces) describe(self, arguments) else null
            var eventDescription: Description? = null

            if (registration.notifies && registration.payload.phase == HookPhase.BEFORE) {
                eventDescription = notify(registration, self, arguments, cacheDescription, HookPhase.BEFORE)
            }

            val result = result(registration, chain, cacheDescription)

            if (registration.notifies && registration.payload.phase == HookPhase.AFTER) {
                eventDescription = notify(registration, self, arguments, cacheDescription, HookPhase.AFTER)
            }

            if (cacheDescription != null && cacheDescription !== eventDescription) {
                NativeJava.releaseIssued(cacheDescription.issued)
            }

            return result
        }
    }

    private fun result(registration: Registration, chain: Chain, description: Description?): Any? {
        if (!registration.replaces) return chain.proceed()

        val description = description ?: return chain.proceed()
        val selfJSON = description.receiver ?: return chain.proceed()
        val argumentsJSON = description.arguments
        val lookup = synchronized(this) { returnValues }
        val cached = lookup.find(registration.token, selfJSON, argumentsJSON) ?: return chain.proceed()
        val value = runCatching { NativeJava.decode(cached) }.getOrElse {
            Logger.error(LogCategory.HOOKS, "Failed to decode a cached Android hook result", it)
            return chain.proceed()
        }

        return coerceReturn(registration.method, value)
    }

    private fun coerceReturn(method: Executable, value: Any?): Any? {
        if (method !is Method) return value
        return NativeJava.coerceTo(method.returnType, value)
    }

    private fun notify(
        registration: Registration,
        self: Any?,
        arguments: List<Any?>,
        cacheDescription: Description?,
        phase: HookPhase,
    ): Description? {
        val target = synchronized(this) { dispatcher } ?: return null
        val indexes = registration.payload.arguments ?: arguments.indices.toList()
        val useCacheDescription =
            cacheDescription != null &&
                registration.payload.receiver &&
                indexes.size == arguments.size &&
                indexes.indices.all { indexes[it] == it }
        val description = if (useCacheDescription) {
            requireNotNull(cacheDescription)
        } else {
            describe(
                self,
                indexes.map(arguments::get),
                registration.payload.receiver,
            )
        }
        val payload = JSONObject()
        description.receiver?.let { payload.put("self", JSONTokener(it).nextValue()) }
        payload.put("args", JSONArray(description.arguments))
            .put("argumentIndexes", JSONArray(indexes))
            .put("phase", phase.wireName)
        val dispatched = runCatching {
            target.dispatch(registration.token, payload.toString())
        }.onFailure {
            Logger.error(LogCategory.HOOKS, "Failed to dispatch an Android hook event", it)
        }.isSuccess
        if (!dispatched) {
            NativeJava.releaseIssued(description.issued)
            return null
        }
        return description
    }

    private fun describe(
        self: Any?,
        arguments: List<Any?>,
        includeReceiver: Boolean = true,
    ): Description {
        val (encoded, issued) = NativeJava.recordingIssues {
            (if (includeReceiver) NativeJava.describe(self) else null) to NativeJava.describeAll(arguments)
        }
        return Description(encoded.first, encoded.second, issued)
    }

    private fun payloadSelection(
        options: JSONObject,
        argumentCount: Int,
        defaultPhase: HookPhase,
    ): PayloadSelection {
        if (!options.has("payload")) return PayloadSelection(true, null, defaultPhase)
        val payload = options.optJSONObject("payload")
            ?: throw IllegalArgumentException("The hook payload options must be an object")
        val receiver = payload.opt("receiver")?.let {
            it as? Boolean ?: throw IllegalArgumentException("The hook payload receiver must be boolean")
        } ?: true
        val arguments = if (payload.has("arguments")) {
            val selected = payload.optJSONArray("arguments")
                ?: throw IllegalArgumentException("The hook payload arguments must be an array")
            val indexes = mutableListOf<Int>()
            for (index in 0 until selected.length()) {
                val value = selected.opt(index)
                val number = value as? Number
                    ?: throw IllegalArgumentException("The hook payload argument index must be an integer")
                val selectedIndex = number.toDouble().toInt()
                require(number.toDouble() == selectedIndex.toDouble()) {
                    "The hook payload argument index must be an integer"
                }
                require(selectedIndex in 0 until argumentCount) {
                    "The hook payload argument index is out of range"
                }
                require(selectedIndex !in indexes) {
                    "The hook payload argument indexes must be unique"
                }
                indexes.add(selectedIndex)
            }
            indexes
        } else {
            null
        }
        val phase = payload.opt("phase")?.let {
            it as? String ?: throw IllegalArgumentException("The hook payload phase must be a string")
        }
        val selectedPhase = when (phase) {
            null -> defaultPhase
            HookPhase.BEFORE.wireName -> HookPhase.BEFORE
            HookPhase.AFTER.wireName -> HookPhase.AFTER
            else -> throw IllegalArgumentException("The hook payload phase must be before or after")
        }
        return PayloadSelection(receiver, arguments, selectedPhase)
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
