using Microsoft.AspNetCore.Identity;

namespace BalSanskar.Web.Data;

public class AppUser : IdentityUser
{
    /// <summary>How this teacher is credited on a session write-up.</summary>
    public string DisplayName { get; set; } = "";
}
