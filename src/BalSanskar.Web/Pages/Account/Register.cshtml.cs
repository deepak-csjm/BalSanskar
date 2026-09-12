using System.ComponentModel.DataAnnotations;
using BalSanskar.Web.Data;
using BalSanskar.Web.Options;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace BalSanskar.Web.Pages.Account;

/// <summary>
/// Registration is deliberately not open to the internet. The first account
/// bootstraps the class; every later teacher needs the shared invite code.
/// If no code is configured, registration simply closes after the first
/// account rather than falling open — failing shut, not open.
/// </summary>
public class RegisterModel(
    UserManager<AppUser> userManager,
    SignInManager<AppUser> signInManager,
    AppDbContext db,
    IOptions<GroupOptions> groupOptions) : PageModel
{
    [BindProperty]
    public InputModel Input { get; set; } = new();

    public string? Error { get; set; }
    public bool IsFirstAccount { get; private set; }
    public bool RegistrationClosed { get; private set; }

    public class InputModel
    {
        [Required, StringLength(120, MinimumLength = 2)]
        public string DisplayName { get; set; } = "";

        [Required, EmailAddress]
        public string Email { get; set; } = "";

        [Required, StringLength(200, MinimumLength = 12)]
        [DataType(DataType.Password)]
        public string Password { get; set; } = "";

        public string? InviteCode { get; set; }
    }

    private async Task LoadStateAsync()
    {
        IsFirstAccount = !await db.Users.AnyAsync();
        RegistrationClosed = !IsFirstAccount && string.IsNullOrWhiteSpace(groupOptions.Value.InviteCode);
    }

    public async Task OnGetAsync() => await LoadStateAsync();

    public async Task<IActionResult> OnPostAsync()
    {
        await LoadStateAsync();

        if (RegistrationClosed) return Page();
        if (!ModelState.IsValid) return Page();

        if (!IsFirstAccount)
        {
            var expected = groupOptions.Value.InviteCode;
            var supplied = Input.InviteCode ?? "";
            if (!CryptographicEquals(expected, supplied))
            {
                Error = "That invite code is not right.";
                return Page();
            }
        }

        var user = new AppUser
        {
            UserName = Input.Email,
            Email = Input.Email,
            DisplayName = Input.DisplayName.Trim(),
        };

        var result = await userManager.CreateAsync(user, Input.Password);
        if (!result.Succeeded)
        {
            Error = string.Join(" ", result.Errors.Select(e => e.Description));
            return Page();
        }

        await signInManager.SignInAsync(user, isPersistent: true);
        return RedirectToPage("/Index");
    }

    /// <summary>Length-constant comparison so the invite code cannot be guessed by timing.</summary>
    private static bool CryptographicEquals(string a, string b) =>
        System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(
            System.Text.Encoding.UTF8.GetBytes(a),
            System.Text.Encoding.UTF8.GetBytes(b));
}
