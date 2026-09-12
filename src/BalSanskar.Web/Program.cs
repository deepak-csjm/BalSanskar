using BalSanskar.Web.Data;
using BalSanskar.Web.Options;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<GroupOptions>(builder.Configuration.GetSection(GroupOptions.SectionName));

// SQLite on a mounted volume in production, next to the project in development.
// Thirty children and one teacher writing once a week does not need a database
// server, and a managed one is another thing to keep alive between rare visits.
var dbPath = builder.Configuration["Database:Path"]
             ?? Path.Combine(builder.Environment.ContentRootPath, "balsanskar.db");
Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(dbPath))!);
builder.Services.AddDbContext<AppDbContext>(o => o.UseSqlite($"Data Source={dbPath}"));

builder.Services
    .AddIdentityCore<AppUser>(o =>
    {
        // NIST SP 800-63B: enforce length, not character classes. Composition
        // rules push volunteers towards "Balvihar1!" instead of a real passphrase.
        o.Password.RequiredLength = 12;
        o.Password.RequireNonAlphanumeric = false;
        o.Password.RequireUppercase = false;
        o.Password.RequireLowercase = false;
        o.Password.RequireDigit = false;
        o.User.RequireUniqueEmail = true;
        o.Lockout.MaxFailedAccessAttempts = 5;
    })
    .AddEntityFrameworkStores<AppDbContext>()
    .AddSignInManager();

builder.Services.AddAuthentication(IdentityConstants.ApplicationScheme).AddIdentityCookies();

builder.Services.ConfigureApplicationCookie(o =>
{
    o.LoginPath = "/Account/Login";
    o.LogoutPath = "/Account/Logout";
    o.AccessDeniedPath = "/Account/Login";
    // A volunteer opening this once a week should not be logged out every time.
    o.ExpireTimeSpan = TimeSpan.FromDays(60);
    o.SlidingExpiration = true;
});

builder.Services.AddAuthorization();
builder.Services.AddRazorPages(o =>
{
    o.Conventions.AuthorizeFolder("/");
    o.Conventions.AllowAnonymousToPage("/Account/Login");
    o.Conventions.AllowAnonymousToPage("/Account/Register");
});

// Fly/Render/Azure terminate TLS upstream; without this the app thinks every
// request is plain HTTP and the auth cookie's Secure flag misbehaves.
builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    o.KnownIPNetworks.Clear();
    o.KnownProxies.Clear();
});

var app = builder.Build();

app.UseForwardedHeaders();

using (var scope = app.Services.CreateScope())
{
    scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.Migrate();
}

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
}

app.UseStaticFiles();
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();
app.MapRazorPages();

app.Run();
