package app.unbound.manager.core

fun plainText(markdown: String): String = markdown.lines().joinToString("\n") { line ->
    line.trimEnd()
        .replace(HEADING, "")
        .replace(BULLET, "$1• ")
        .replace(LINK) { it.groupValues[1] }
        .replace(EMPHASIS, "")
}.replace(BLANK_RUN, "\n\n").trim()

private val HEADING = Regex("""^\s*#{1,6}\s+""")
private val BULLET = Regex("""^(\s*)[*+-]\s+""")
private val LINK = Regex("""!?\[([^\]]*)]\([^)]*\)""")
private val EMPHASIS = Regex("""\*\*|__|`""")
private val BLANK_RUN = Regex("""\n{3,}""")
