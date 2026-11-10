# Native classes and methods

- `ubd debug inspect class <name> [--filter text]`: a Java class's superclasses, constructors, methods and fields. iOS shows the superclass chain only.
- `ubd debug hook <class> <method> [--parameters type ...] [--duration ms]`: records calls to a Java method or Objective-C selector. Hook a specific class, never a method every view calls.
