using BalSanskar.Web.Data;
using BalSanskar.Web.Options;
using BalSanskar.Web.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace BalSanskar.Web.Pages;

public class SessionModel(AppDbContext db, IOptions<GroupOptions> groupOptions) : PageModel
{
    public ClassSession Session { get; private set; } = null!;
    public string Recap { get; private set; } = "";

    public async Task<IActionResult> OnGetAsync(int id)
    {
        var session = await db.Sessions.AsNoTracking().FirstOrDefaultAsync(s => s.Id == id);
        if (session is null) return NotFound();

        Session = session;
        Recap = RecapBuilder.Build(session, groupOptions.Value);
        return Page();
    }

    public async Task<IActionResult> OnPostDeleteAsync(int id)
    {
        var session = await db.Sessions.FirstOrDefaultAsync(s => s.Id == id);
        if (session is null) return NotFound();

        db.Sessions.Remove(session);
        await db.SaveChangesAsync();
        return RedirectToPage("/Index");
    }
}
