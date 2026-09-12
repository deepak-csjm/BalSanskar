#!/usr/bin/env python3
"""
End-to-end smoke test against a running API.

Walks the complete journey the platform exists for, in the order a real school
would live it: an officer is appointed, a head teacher is appointed, a teacher
registers and is held until approved, a child is added to the roster, an
activity is written up, publication to the open web is refused for want of
guardian consent, consent is recorded, publication succeeds, the showcase shows
the child's given name and nothing more, consent is withdrawn and the work comes
straight back off the open web.

Deliberately written against HTTP with nothing but the standard library, so it
can be run from a jump host against a staging deployment with no toolchain
installed. The unit and integration suites cover the same rules in more detail;
this is the one that proves the pieces are wired together.

Usage:
    # Start the API with a seeded bootstrap admin, then:
    BALSANSKAR_URL=http://127.0.0.1:4000 python3 scripts/smoke-test.py

It writes to the database it points at. Never run it against production.
"""

import json, os, random, urllib.request, urllib.error

BASE = os.environ.get("BALSANSKAR_URL", "http://127.0.0.1:4100").rstrip("/") + "/v1"
# Whatever SEED_SUPER_ADMIN_PHONE / _PASSWORD were set to when the database was
# seeded. Hardcoding them here once meant this script only ran for whoever
# happened to have typed the same password.
ADMIN_PHONE = os.environ.get("SEED_SUPER_ADMIN_PHONE", "9999900001")
ADMIN_PASSWORD = os.environ.get("SEED_SUPER_ADMIN_PASSWORD", "ChangeThisPassword1")

# Fresh numbers every run, so the script can be run twice against the same
# database. With fixed fixtures the second run collides with the first one's
# accounts and fails on a conflict that has nothing to do with the product.
def _phone() -> str:
    return f"9{random.randint(10**8, 10**9 - 1)}"


OFFICER_PHONE, HEAD_PHONE = _phone(), _phone()
TEACHER_PHONE, HELD_PHONE = _phone(), _phone()


def call(method, path, body=None, token=None, expect=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    if data:
        req.add_header("content-type", "application/json")
    if token:
        req.add_header("authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req) as r:
            payload = r.read().decode()
            status = r.status
    except urllib.error.HTTPError as e:
        payload = e.read().decode()
        status = e.code
    parsed = json.loads(payload) if payload and payload.strip().startswith(("{", "[")) else payload
    if expect and status != expect:
        raise SystemExit(f"FAIL {method} {path}: expected {expect}, got {status}\n{payload[:500]}")
    return status, parsed


steps = []


def ok(label):
    steps.append(f"  ok  {label}")


_, s = call(
    "POST",
    "/auth/password/login",
    {"identifier": ADMIN_PHONE, "password": ADMIN_PASSWORD},
    expect=200,
)
admin = s["tokens"]["accessToken"]
ok("super admin signs in with a plain 10-digit number")

_, districts = call("GET", "/districts", expect=200)
shravasti = next(d for d in districts["items"] if d["code"] == "46")
call("POST", "/users/invite", {
    "phone": OFFICER_PHONE, "fullName": "District Officer", "role": "DISTRICT_ADMIN",
    "districtId": shravasti["id"],
}, token=admin, expect=201)
ok("district officer invited")

_, schools = call("GET", "/schools?limit=10", token=admin, expect=200)
school = next(s for s in schools["items"] if s["udiseCode"] == "09460100101")
call("POST", "/users/invite", {
    "phone": HEAD_PHONE, "fullName": "Sunita Devi", "role": "PRINCIPAL", "schoolId": school["id"],
}, token=admin, expect=201)
ok("head teacher invited")

def register_teacher(phone: str, name: str) -> None:
    _, code = call("POST", "/auth/otp/request", {"phone": phone, "purpose": "REGISTRATION"}, expect=200)
    call("POST", "/auth/register", {
        "phone": phone, "code": code["devCode"], "fullName": name,
        "udiseCode": "09460100101",
    }, expect=201)


# Two applicants rather than one, so that both halves of the rule can be shown
# without waiting out a cooldown. A refused sign-in still consumes the code, and
# a number may only be sent one code a minute for a given purpose — so proving
# "blocked, then approved, then allowed" on a single account would mean sleeping
# sixty seconds in the middle of a smoke test.
register_teacher(TEACHER_PHONE, "Ram Prasad Verma")
register_teacher(HELD_PHONE, "Held Applicant")

_, held_code = call("POST", "/auth/otp/request", {"phone": HELD_PHONE, "purpose": "LOGIN"}, expect=200)
call("POST", "/auth/otp/login", {"phone": HELD_PHONE, "code": held_code["devCode"]}, expect=403)
ok("a teacher who self-registers is refused until somebody approves them")

_, otp3 = call("POST", "/auth/otp/request", {"phone": HEAD_PHONE}, expect=200)
_, hs = call("POST", "/auth/otp/login", {"phone": HEAD_PHONE, "code": otp3["devCode"]}, expect=200)
head_token = hs["tokens"]["accessToken"]
_, pending = call("GET", "/users?status=PENDING_APPROVAL", token=head_token, expect=200)
approved = next(u for u in pending["items"] if u["phone"].endswith(TEACHER_PHONE[-10:]))
call("POST", f"/users/{approved['id']}/approve", {}, token=head_token, expect=200)
ok("head teacher approves one of them and leaves the other waiting")

_, otp4 = call("POST", "/auth/otp/request", {"phone": TEACHER_PHONE, "purpose": "LOGIN"}, expect=200)
_, ts = call("POST", "/auth/otp/login", {"phone": TEACHER_PHONE, "code": otp4["devCode"]}, expect=200)
teacher = ts["tokens"]["accessToken"]
ok("approved teacher signs in")

_, student = call("POST", "/students", {
    "fullName": "Anjali Kumari", "classLevel": "5", "gender": "FEMALE",
    "guardianName": "Ram Kumar", "rollNumber": "12",
}, token=teacher, expect=201)
ok("student added to the roster")

_, activity = call("POST", "/activities", {
    "title": "Reading corner set up in class 5",
    "description": "The children built a reading corner from donated books and now read aloud for twenty minutes each afternoon.",
    "category": "READING_AND_LIBRARY", "occurredOn": "2026-09-01", "classLevels": ["5"],
    "participantCount": 32, "studentIds": [student["id"]],
}, token=teacher, expect=201)
call("POST", f"/activities/{activity['id']}/submit", {"requestedVisibility": "PUBLIC"}, token=teacher, expect=200)

_, otp5 = call("POST", "/auth/otp/request", {"phone": OFFICER_PHONE}, expect=200)
_, osess = call("POST", "/auth/otp/login", {"phone": OFFICER_PHONE, "code": otp5["devCode"]}, expect=200)
officer_token = osess["tokens"]["accessToken"]

_, baseline = call("GET", "/reports/overview", token=officer_token, expect=200)

# The gate out of the school, in the order a real school walks it. See
# docs/integrity.md: the head teacher attests, the block clears, and only then
# can anyone raise it to the open web.
status, err = call("POST", f"/activities/{activity['id']}/moderate",
                   {"decision": "PUBLISH", "visibility": "DISTRICT"}, token=head_token)
assert status == 409 and "attestation" in err["error"]["message"].lower(), err
ok("work cannot leave the school without the head teacher's attestation")

call("POST", f"/activities/{activity['id']}/moderate", {
    "decision": "PUBLISH", "visibility": "DISTRICT",
    "attestation": {"confirmed": True},
}, token=head_token, expect=200)
_, gated = call("GET", f"/activities/{activity['id']}", token=head_token, expect=200)
assert gated["visibility"] == "SCHOOL", gated["visibility"]
assert gated["clearance"] == "AWAITING_BLOCK", gated["clearance"]
ok("attested work waits at school visibility until the block has looked at it")

call("POST", f"/activities/{activity['id']}/clearance",
     {"decision": "CLEAR"}, token=officer_token, expect=200)
ok("the block officer clears it")

status, err = call("POST", f"/activities/{activity['id']}/moderate",
                   {"decision": "PUBLISH", "visibility": "PUBLIC"}, token=officer_token)
assert status == 409 and "consent" in err["error"]["message"].lower(), err
ok("public publish refused while guardian consent is missing")

call("POST", f"/students/{student['id']}/consent", {
    "status": "GRANTED", "method": "PAPER_FORM", "guardianName": "Ram Kumar", "guardianRelation": "Father",
}, token=teacher, expect=201)
call("POST", f"/activities/{activity['id']}/moderate",
     {"decision": "PUBLISH", "visibility": "PUBLIC"}, token=officer_token, expect=200)
ok("public publish succeeds once consent is on file")

_, pub = call("GET", f"/public/activities/{activity['id']}", expect=200)
raw = json.dumps(pub, ensure_ascii=False)
assert "Anjali" in raw and "Kumari" not in raw, raw
assert "Ram Kumar" not in raw and TEACHER_PHONE not in raw, raw
ok("showcase shows the given name, never the surname, guardian or phone")

_, rev = call("POST", f"/students/{student['id']}/consent/revoke",
              {"reason": "The family asked us to remove it."}, token=teacher, expect=200)
assert rev["unpublishedActivityCount"] == 1, rev
call("GET", f"/public/activities/{activity['id']}", expect=404)
ok("withdrawing consent pulls it off the open web immediately")

_, report = call("GET", "/reports/overview", token=officer_token, expect=200)
# A delta rather than an absolute. The script is meant to be runnable against a
# database that already has work in it — asserting a total means it only ever
# passes on the first run, which is the same as not asserting anything.
published = report["totals"]["publishedActivities"] - baseline["totals"]["publishedActivities"]
assert published == 1, f"expected this run to add one published activity, added {published}"
ok(f"district report: {report['totals']['publishedActivities']} published in all, "
   f"{report['participationRate']['schools']:.0%} of schools active")

status, _ = call("GET", "/reports/overview?districtId=" + districts["items"][0]["id"], token=officer_token)
assert status == 403, status
ok("officer refused a report for a district they do not administer")

print("End-to-end smoke test against a live server and PostgreSQL")
print("\n".join(steps))
print("\nAll steps passed.")
