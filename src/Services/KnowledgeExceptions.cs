using System;

namespace SocialSense.Services;

public class DuplicateKnowledgeException : Exception
{
    public DuplicateKnowledgeException(string message) : base(message) { }
}

public class UnsupportedWebsiteException : Exception
{
    public UnsupportedWebsiteException(string message) : base(message) { }
}

public class EmptyContentException : Exception
{
    public EmptyContentException(string message) : base(message) { }
}

public class InvalidFileException : Exception
{
    public InvalidFileException(string message) : base(message) { }
}
