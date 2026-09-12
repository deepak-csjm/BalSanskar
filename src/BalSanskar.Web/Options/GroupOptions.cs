namespace BalSanskar.Web.Options;

/// <summary>Per-group wording, so the app is not hard-coded to one class.</summary>
public class GroupOptions
{
    public const string SectionName = "Group";

    /// <summary>Name of the class, used in the parent message sign-off.</summary>
    public string Name { get; set; } = "Our class";

    /// <summary>Opening line of the parent message. Blank to omit.</summary>
    public string Greeting { get; set; } = "Namaste";

    /// <summary>
    /// Shared code required to create an account. Keeps the public
    /// registration page from being open to the world.
    /// </summary>
    public string InviteCode { get; set; } = "";
}
