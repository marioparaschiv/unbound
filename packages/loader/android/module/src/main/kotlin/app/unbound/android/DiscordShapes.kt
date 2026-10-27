package app.unbound.android

import java.lang.reflect.AccessibleObject
import java.lang.reflect.Field
import java.lang.reflect.Method
import java.lang.reflect.Modifier

data class DiscordShape(
    val owner: String? = null,
    val ownerShape: String? = null,
    val extends: String? = null,
    val implements: String? = null,
    val parameterOf: String? = null,
    val withFields: List<String>? = null,
    val unlessClass: String? = null,
    val member: String,
    val name: String? = null,
    val static: Boolean? = null,
    val type: String? = null,
    val typeAssignableTo: String? = null,
    val returnsAssignableFrom: String? = null,
    val firstParameter: String? = null,
    val parameterCount: Int? = null,
    val parameters: List<String>? = null,
    val count: Int? = null,
    val pick: String,
)

class DiscordShapes(private val rules: Map<String, DiscordShape>, private val resolve: (String) -> Class<*>?) {
    fun shapeClass(name: String): Class<*> {
        val shape = rule(name)
        return ownerOf(name, shape).also { owner -> picked(name, shape, owner) }
    }

    fun shapeField(name: String): Field = single(name, MEMBER_FIELD) as Field

    fun shapeFields(name: String): List<Field> {
        val shape = rule(name, MEMBER_FIELD)
        return picked(name, shape, ownerOf(name, shape)).map { it as Field }
    }

    fun shapeMethod(name: String): Method = single(name, MEMBER_METHOD) as Method

    private fun single(name: String, member: String): AccessibleObject {
        val shape = rule(name, member)
        return picked(name, shape, ownerOf(name, shape)).single()
    }

    private fun rule(name: String, member: String? = null): DiscordShape {
        val shape = rules[name] ?: throw IllegalArgumentException("There is no Discord shape named $name")
        require(member == null || shape.member == member) {
            "The Discord shape $name describes a ${shape.member}, not a $member"
        }
        return shape
    }

    private fun ownerOf(name: String, shape: DiscordShape): Class<*> {
        shape.owner?.let { return resolve(it) ?: throw IllegalStateException("The Discord shape $name needs $it, which is missing") }
        shape.ownerShape?.let { return shapeClass(it) }
        val parameterOf = shape.parameterOf
            ?: throw IllegalArgumentException("The Discord shape $name names no class the loader can start from")
        val source = resolve(parameterOf) ?: throw IllegalStateException("The Discord shape $name needs $parameterOf, which is missing")
        val owners = source.declaredMethods
            .mapNotNull { it.parameterTypes.singleOrNull() }
            .distinct()
            .filter { selects(shape, it) && matches(shape, it).size == expected(shape) }
        return owners.singleOrNull() ?: throw IllegalStateException(
            if (owners.isEmpty()) {
                "No class taken alone by a $parameterOf method fits the Discord shape $name"
            } else {
                "Several classes fit the Discord shape $name, ${owners.joinToString { it.name }}, so the lookup is ambiguous"
            },
        )
    }

    private fun picked(name: String, shape: DiscordShape, owner: Class<*>): List<AccessibleObject> {
        val matches = matches(shape, owner)
        val wanted = expected(shape)
        check(matches.size == wanted) {
            when {
                matches.isEmpty() -> "${owner.name} has no ${shape.member} that fits the Discord shape $name"

                shape.pick == PICK_ALL ->
                    "${owner.name} has ${matches.size} ${shape.member}s that fit the Discord shape $name, expected $wanted"

                else -> "Several members of ${owner.name} fit the Discord shape $name, so the lookup is ambiguous"
            }
        }
        return matches.onEach { it.isAccessible = true }
    }

    private fun expected(shape: DiscordShape): Int = if (shape.pick == PICK_ALL) shape.count ?: 0 else 1

    private fun matches(shape: DiscordShape, owner: Class<*>): List<AccessibleObject> {
        val candidates: List<Pair<AccessibleObject, List<Class<*>>>> = when (shape.member) {
            MEMBER_FIELD -> owner.declaredFields.filter { fits(shape, it) }.map { it to emptyList() }

            MEMBER_METHOD -> owner.declaredMethods.filter { fits(shape, it) }.map { it to it.parameterTypes.toList() }

            MEMBER_CONSTRUCTOR ->
                owner.declaredConstructors
                    .filter { fitsParameters(shape, it.parameterTypes.toList()) }
                    .map { it to it.parameterTypes.toList() }

            else -> throw IllegalArgumentException("Discord shapes cannot describe a ${shape.member}")
        }
        if (shape.pick != PICK_LONGEST || candidates.size < 2) return candidates.map { it.first }
        val longest = candidates.maxOf { it.second.size }
        return candidates.filter { it.second.size == longest }.map { it.first }
    }

    private fun fits(shape: DiscordShape, field: Field): Boolean =
        (shape.name == null || field.name == shape.name) &&
            (shape.static == null || Modifier.isStatic(field.modifiers) == shape.static) &&
            (shape.type == null || field.type == type(shape.type)) &&
            (shape.typeAssignableTo == null || type(shape.typeAssignableTo)?.isAssignableFrom(field.type) == true)

    private fun fits(shape: DiscordShape, method: Method): Boolean =
        (shape.name == null || method.name == shape.name) &&
            (shape.static == null || Modifier.isStatic(method.modifiers) == shape.static) &&
            (shape.returnsAssignableFrom == null || returnsAssignableFrom(method, shape.returnsAssignableFrom)) &&
            fitsParameters(shape, method.parameterTypes.toList())

    private fun returnsAssignableFrom(method: Method, name: String): Boolean {
        val type = type(name) ?: return false
        return method.returnType != Any::class.java && method.returnType.isAssignableFrom(type)
    }

    private fun fitsParameters(shape: DiscordShape, parameters: List<Class<*>>): Boolean =
        (shape.firstParameter == null || parameters.firstOrNull() == type(shape.firstParameter)) &&
            (shape.parameterCount == null || parameters.size == shape.parameterCount) &&
            (shape.parameters == null || shape.parameters.map(::type) == parameters)

    private fun selects(shape: DiscordShape, candidate: Class<*>): Boolean =
        (shape.extends == null || candidate.superclass == type(shape.extends)) &&
            (shape.implements == null || type(shape.implements) in candidate.interfaces) &&
            shape.withFields.orEmpty().all { fieldType ->
                candidate.declaredFields.any { !Modifier.isStatic(it.modifiers) && it.type == type(fieldType) }
            }

    private fun type(name: String): Class<*>? = PRIMITIVES[name] ?: resolve(name)

    companion object {
        private const val MEMBER_FIELD = "field"
        private const val MEMBER_METHOD = "method"
        private const val MEMBER_CONSTRUCTOR = "constructor"
        private const val PICK_LONGEST = "most-parameters"
        private const val PICK_ALL = "all"

        private val PRIMITIVES: Map<String, Class<*>> = listOf(
            java.lang.Boolean.TYPE,
            java.lang.Byte.TYPE,
            Character.TYPE,
            java.lang.Short.TYPE,
            Integer.TYPE,
            java.lang.Long.TYPE,
            java.lang.Float.TYPE,
            java.lang.Double.TYPE,
            Void.TYPE,
        ).associateBy { it.name }

        fun forClassLoader(classLoader: ClassLoader): DiscordShapes = DiscordShapes(DISCORD_SHAPE_RULES) { name ->
            runCatching { Class.forName(name, false, classLoader) }.getOrNull()
        }
    }
}
