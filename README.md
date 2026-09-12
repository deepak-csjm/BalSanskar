# BalSanskar

A write-up journal for whoever teaches a weekly children's values class.

The class runs for an hour. Then it evaporates — what was taught lives in one
volunteer's head, parents never learn what to reinforce at home, and the next
teacher starts from nothing. This closes that gap and nothing else.

## What it does

1. **Write up the session** — two minutes after class, on your phone. Only the
   theme is required.
2. **Get a parent message** — the write-up is turned into a short message you
   paste straight into the parents' WhatsApp group.
3. **Build a plan bank** — after a year the journal is a searchable record of
   everything the class has run, written by your own teachers. "Run this again"
   starts a new session prefilled from an old one.

The parent message is the point. Logging a session only pays off months later;
the message pays off the same minute, which is what makes anyone bother.

## What it deliberately does not do

**No data about the children. No roster, no names, no attendance.**
Processing minors' personal data pulls a volunteer-run class into
DPDP Act 2023 (India) and GDPR Article 8 consent territory that it cannot
realistically meet — verifiable parental consent, retention policies, subject
access. Attendance registers are also the least-read data in any class. The
cost is real and the benefit is close to zero, so it is out. See
[docs/decisions.md](docs/decisions.md).

Also out, on purpose: parent logins, per-child progress, a content library, a
mobile app, notifications. Each is a plausible later feature and a certain way
to never finish the first one.

## Running it locally

```bash
dotnet run --project src/BalSanskar.Web
```

Then open the URL it prints. The first account you create needs no invite
code — after that, everyone needs the code from configuration.

```bash
dotnet test        # 17 tests, no database or browser needed
```

## Configuration

| Setting | What it is |
| --- | --- |
| `Group:Name` | Class name, used in the parent message. |
| `Group:Greeting` | Opening line of the parent message. Blank to omit. |
| `Group:InviteCode` | Shared code required to create an account after the first. |
| `Database:Path` | Where the SQLite file lives. Defaults next to the project. |

**Never commit a real invite code.** In production set it as an environment
variable — `Group__InviteCode` — not in `appsettings.json`. If no code is set,
registration closes after the first account rather than falling open.

## Deploying

Built to run as one container with one SQLite file on a mounted volume.

> **The container config is the one part of this repo that has not been run.**
> It was written without a container runtime available, so unlike the app and
> its tests it is unverified. Expect one round of fixes on the first deploy.

> The container config is the one part of this repo that has **not** been run —
> it was written without a container runtime to hand. Expect one round of
> fixes on the first deploy.

```bash
fly launch --no-deploy      # first time only
fly volumes create balsanskar_data --size 1 --region bom
fly secrets set Group__InviteCode="pick-something-only-your-teachers-know"
fly deploy
```

Any host that runs a container with a persistent volume works the same way.
Point `Database__Path` at the mount.

**Back it up.** The whole class is one file. Fly snapshots the volume daily;
if you host elsewhere, arrange something equivalent before you rely on it.

## Design notes

- **Razor Pages, plain form posts.** Not Blazor Server: that needs a live
  WebSocket, and a teacher on classroom wifi would get the reconnect modal
  mid-write-up. Ordinary forms just work.
- **No CSS or JS framework.** ~80 lines of hand-written CSS. The one script on
  the site is the copy button, and it degrades to selecting the text.
- **No repository or DTO layer.** EF entities are used directly in pages. With
  one table, those layers are pure cost.
- **SQLite, single writer.** Thirty children and one teacher writing once a
  week. A database server would be more to keep alive than to use.

## Layout

```
src/BalSanskar.Web/
  Data/          ClassSession, AppUser, DbContext, migrations
  Services/      RecapBuilder — turns a write-up into the parent message
  Options/       Per-group wording and the invite code
  Pages/         Index (journal), Log (write-up), Session (detail + recap), Account/
tests/           Unit tests for the recap and search escaping
```

The one piece of real logic is `Services/RecapBuilder.cs`. It is a pure
function and fully covered by tests — start there.
