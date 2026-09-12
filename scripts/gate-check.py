#!/usr/bin/env python3
"""
Walk the claim-and-clearance journey against a running API.

The companion to scripts/smoke-test.py, covering the other half of the product:
how a school gets onto the platform, and what it takes for that school's work to
be seen outside it. See docs/integrity.md for why either exists.

What this adds over the integration suite is that it sends the request bodies
the web screens actually construct. A screen that builds a body the API rejects
typechecks perfectly and fails in a block office.

It needs the demo seed (SEED_DEMO=true), which creates the one thing no journey
in the product can create by itself: a block education officer. Everything below
that officer — the school, its head teacher, its teachers — is created here by
walking the real flows, because those flows are the thing under test.

Usage:
    BALSANSKAR_URL=http://127.0.0.1:4000 python3 scripts/gate-check.py

It writes to the database it points at. Never run it against production.
"""
import json, os, urllib.request, urllib.error, random

BASE = os.environ.get("BALSANSKAR_URL", "http://127.0.0.1:4000").rstrip("/") + "/v1"

# The block officer the demo seed appoints, in Gilaula block of Shravasti.
BLOCK_OFFICER = os.environ.get("DEMO_BLOCK_OFFICER", "9999900011")
DISTRICT_OFFICER = os.environ.get("DEMO_DISTRICT_OFFICER", "9999900010")

def call(method, path, body=None, token=None, expect=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    if data:
        req.add_header("content-type", "application/json")
    if token:
        req.add_header("authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req) as r:
            payload, status = r.read().decode(), r.status
    except urllib.error.HTTPError as e:
        payload, status = e.read().decode(), e.code
    parsed = json.loads(payload) if payload and payload.strip().startswith(("{", "[")) else payload
    if expect and status != expect:
        raise SystemExit(f"FAIL {method} {path}: expected {expect}, got {status}\n{payload[:700]}")
    return status, parsed

out = []
def ok(label): out.append(f"  ok  {label}")

# The two officers the demo seed creates. Everyone below them is created by the
# journeys under test, which is the point.
status, sent = call("POST", "/auth/otp/request", {"phone": BLOCK_OFFICER, "purpose": "LOGIN"})
if status == 429:
    # A one-minute cooldown per number, which running this script twice in quick
    # succession trips. Saying so beats printing a raw 429 at someone.
    raise SystemExit(
        f"The one-time code for {BLOCK_OFFICER} is still within its cooldown.\n"
        f"  {sent.get('error', {}).get('message', sent)}\n"
        "This is the resend guard working, not a failure. Wait and run again."
    )
if status == 404:
    raise SystemExit(
        f"No account for {BLOCK_OFFICER}. This script needs the demo seed:\n"
        "  SEED_SUPER_ADMIN_PHONE=... SEED_SUPER_ADMIN_PASSWORD=... SEED_DEMO=true pnpm db:seed"
    )
if status != 200:
    raise SystemExit(f"Could not request a code for {BLOCK_OFFICER}: {status} {sent}")
_, bo_session = call("POST", "/auth/otp/login",
                     {"phone": BLOCK_OFFICER, "code": sent["devCode"]}, expect=200)
officer = bo_session["tokens"]["accessToken"]
assert bo_session["user"]["role"] == "BLOCK_ADMIN", bo_session["user"]
block = {"id": bo_session["user"]["blockId"]}
ok("the seeded block officer signs in by one-time code")

# --- the claim screen's payload, verbatim -----------------------------------
udise = "".join(str(random.randint(0, 9)) for _ in range(11))
head_phone = f"97{random.randint(10**7, 10**8 - 1)}"
_, sent = call("POST", "/auth/otp/request", {"phone": head_phone, "purpose": "REGISTRATION"}, expect=200)
_, receipt = call("POST", "/school-claims", {
    "phone": head_phone, "code": sent["devCode"], "udiseCode": udise,
    "blockId": block["id"], "proposedNameHi": "प्राथमिक विद्यालय रामपुर",
    "proposedType": "PRIMARY", "claimantName": "Kavita Singh",
    "villageOrWard": "Rampur", "claimantDesignation": "प्रधानाध्यापक",
}, expect=201)
assert receipt["status"] == "PENDING", receipt
ok("head teacher claims a school that is not on the register")

# The collision the receipt screen renders.
rival = f"96{random.randint(10**7, 10**8 - 1)}"
_, sent = call("POST", "/auth/otp/request", {"phone": rival, "purpose": "REGISTRATION"}, expect=200)
_, collision = call("POST", "/school-claims", {
    "phone": rival, "code": sent["devCode"], "udiseCode": udise,
    "blockId": block["id"], "proposedNameHi": "प्राथमिक विद्यालय रामपुर",
    "proposedType": "PRIMARY", "claimantName": "Someone Else",
}, expect=200)
assert collision["status"] == "ALREADY_CLAIMED", collision
assert collision["existingClaimantHint"], "the second claimant is told nothing at all"
assert "Singh" not in collision["existingClaimantHint"], collision["existingClaimantHint"]
ok(f"a second claimant is shown only \"{collision['existingClaimantHint']}\"")

# --- the claims queue -------------------------------------------------------
_, queue = call("GET", "/school-claims?status=PENDING&limit=50", token=officer, expect=200)
mine = [c for c in queue["items"] if c["udiseCode"] == udise]
assert len(mine) == 1, f"expected one claim, got {len(mine)}"
claim = mine[0]
assert claim["matchesRegister"] is False
ok("the claim reaches the block officer's queue, flagged as a new school")

_, verified = call("POST", f"/school-claims/{claim['id']}/decide", {
    "decision": "VERIFY", "correctedNameHi": "प्राथमिक विद्यालय रामपुर, विकास खंड",
}, token=officer, expect=200)
ok("the officer confirms it, correcting the name")

_, sent = call("POST", "/auth/otp/request", {"phone": head_phone, "purpose": "LOGIN"}, expect=200)
_, head_session = call("POST", "/auth/otp/login",
                       {"phone": head_phone, "code": sent["devCode"]}, expect=200)
head = head_session["tokens"]["accessToken"]
assert head_session["user"]["role"] == "PRINCIPAL", head_session["user"]
school_id = head_session["user"]["schoolId"]
ok("the claimant can now sign in, as head teacher of the new school")

# --- a teacher, so the head teacher is moderating somebody else's work ------
t_phone = f"95{random.randint(10**7, 10**8 - 1)}"
_, sent = call("POST", "/auth/otp/request", {"phone": t_phone, "purpose": "REGISTRATION"}, expect=200)
call("POST", "/auth/register", {
    "phone": t_phone, "code": sent["devCode"], "fullName": "Ram Prasad",
    "udiseCode": udise, "designation": "सहायक अध्यापक",
}, expect=201)
_, people = call("GET", "/users?status=PENDING_APPROVAL&limit=50", token=head, expect=200)
newcomer = next(u for u in people["items"] if u["phone"].endswith(t_phone[-10:]))
call("POST", f"/users/{newcomer['id']}/approve", {}, token=head, expect=200)
_, sent = call("POST", "/auth/otp/request", {"phone": t_phone, "purpose": "LOGIN"}, expect=200)
_, t_session = call("POST", "/auth/otp/login", {"phone": t_phone, "code": sent["devCode"]}, expect=200)
teacher = t_session["tokens"]["accessToken"]
ok("a teacher registers at the new school and the head teacher approves them")

# --- the gate ---------------------------------------------------------------
_, activity = call("POST", "/activities", {
    "title": "कक्षा 5 का पुस्तकालय कोना",
    "description": "बच्चों ने दान में मिली किताबों से कक्षा में पढ़ने का कोना बनाया और हर सुबह बीस मिनट पढ़ते हैं।",
    "category": "READING_AND_LIBRARY", "occurredOn": "2026-09-10",
    "classLevels": ["5"], "studentIds": [], "tags": [],
}, token=teacher, expect=201)
aid = activity["id"]
call("POST", f"/activities/{aid}/submit", {"requestedVisibility": "DISTRICT"}, token=teacher, expect=200)
ok("a teacher submits, asking for district visibility")

# A head teacher may not clear their own school's work.
status, refused = call("POST", f"/activities/{aid}/clearance", {"decision": "CLEAR"}, token=head)
assert status == 403, f"a head teacher cleared their own school's work: {status}"
ok("the head teacher is refused the clearance decision on their own school")

# Publishing without the attestation must be refused.
status, _ = call("POST", f"/activities/{aid}/moderate",
                 {"decision": "PUBLISH", "visibility": "DISTRICT"}, token=head)
assert status in (400, 409, 422), f"work left the school with no attestation: {status}"
ok("sending work beyond the school without attesting is refused")

# The moderation panel's "publish within the school" button.
_, inside = call("POST", f"/activities/{aid}/moderate",
                 {"decision": "PUBLISH", "visibility": "SCHOOL"}, token=head, expect=200)
assert inside["visibility"] == "SCHOOL", inside
ok("publishing within the school needs nobody else")

# A fresh one for the attest-and-send-on button.
_, activity2 = call("POST", "/activities", {
    "title": "बाल वाटिका में पालक की बुवाई",
    "description": "बच्चों ने विद्यालय की क्यारी में पालक और धनिया बोया और बारी-बारी से रोज़ सुबह पानी देते हैं।",
    "category": "COMMUNITY_ENGAGEMENT", "occurredOn": "2026-09-11",
    "classLevels": ["4"], "studentIds": [], "tags": [],
}, token=teacher, expect=201)
bid = activity2["id"]
call("POST", f"/activities/{bid}/submit", {"requestedVisibility": "DISTRICT"}, token=teacher, expect=200)
_, attested = call("POST", f"/activities/{bid}/moderate", {
    "decision": "PUBLISH", "visibility": "DISTRICT",
    "attestation": {"confirmed": True, "note": "मैंने स्वयं देखा।"},
}, token=head, expect=200)
ok("the head teacher attests and sends it on")

_, detail = call("GET", f"/activities/{bid}", token=head, expect=200)
assert detail["clearance"] == "AWAITING_BLOCK", detail["clearance"]
assert detail["visibility"] == "SCHOOL", (
    f"attested work was visible at {detail['visibility']} before the block looked")
ok("until the block looks, it is visible only inside the school")

_, cq = call("GET", "/clearance-queue?limit=50", token=officer, expect=200)
item = next((i for i in cq["items"] if i["activityId"] == bid), None)
assert item, "attested work never reached the block officer's queue"
assert item["target"] == "DISTRICT", item["target"]
assert item["reason"] in ("FLAGGED", "SAMPLED")
assert len(item["riskFlags"]) == len(item["riskNotes"]), "a flag with no sentence beside it"
ok(f"it reaches the clearance queue: {item['reason']}, risk {item['riskScore']}, "
   f"flags {item['riskFlags'] or 'none'}")

_, trust = call("GET", f"/schools/{school_id}/trust", token=officer, expect=200)
assert trust["tier"] == "NEW" and trust["sampleRate"] == 1
ok("a brand-new school has every escalation reviewed")

_, cleared = call("POST", f"/activities/{bid}/clearance", {"decision": "CLEAR"},
                  token=officer, expect=200)
_, detail = call("GET", f"/activities/{bid}", token=head, expect=200)
assert detail["clearance"] == "CLEARED", detail["clearance"]
assert detail["visibility"] == "DISTRICT", detail["visibility"]
ok("the block clears it and it becomes visible at district level")

# The promotion panel: a district officer raising cleared work to the open web.
_, sent = call("POST", "/auth/otp/request", {"phone": DISTRICT_OFFICER, "purpose": "LOGIN"}, expect=200)
_, do_session = call("POST", "/auth/otp/login",
                     {"phone": DISTRICT_OFFICER, "code": sent["devCode"]}, expect=200)
do = do_session["tokens"]["accessToken"]
_, promoted = call("POST", f"/activities/{bid}/moderate",
                   {"decision": "PUBLISH", "visibility": "PUBLIC"}, token=do, expect=200)
assert promoted["visibility"] == "PUBLIC", promoted
ok("a district officer promotes cleared work to the open web")

# A return puts the school under watch.
_, activity3 = call("POST", "/activities", {
    "title": "खेल दिवस",
    "description": "विद्यालय में खेल दिवस मनाया गया और बच्चों ने दौड़ तथा कबड्डी में भाग लिया।",
    "category": "SPORTS", "occurredOn": "2026-09-09",
    "classLevels": ["5"], "studentIds": [], "tags": [],
}, token=teacher, expect=201)
cid = activity3["id"]
call("POST", f"/activities/{cid}/submit", {"requestedVisibility": "BLOCK"}, token=teacher, expect=200)
call("POST", f"/activities/{cid}/moderate", {
    "decision": "PUBLISH", "visibility": "BLOCK", "attestation": {"confirmed": True},
}, token=head, expect=200)
status, _ = call("POST", f"/activities/{cid}/clearance", {"decision": "RETURN"}, token=officer)
assert status in (400, 422), f"work was sent back with no reason: {status}"
ok("returning work without saying why is refused")
call("POST", f"/activities/{cid}/clearance",
     {"decision": "RETURN", "note": "तिथि और विवरण मेल नहीं खा रहे। कृपया सुधार कर पुनः भेजें।"},
     token=officer, expect=200)
_, trust = call("GET", f"/schools/{school_id}/trust", token=officer, expect=200)
assert trust["tier"] == "WATCH", trust
ok("one return puts the school back under full review")

print("\n".join(out))
print(f"\n{len(out)} steps passed.")
