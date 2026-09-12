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

import json, os, urllib.request, urllib.error

BASE = os.environ.get("BALSANSKAR_URL", "http://127.0.0.1:4100").rstrip("/") + "/v1"
# Whatever SEED_SUPER_ADMIN_PHONE / _PASSWORD were set to when the database was
# seeded. Hardcoding them here once meant this script only ran for whoever
# happened to have typed the same password.
ADMIN_PHONE = os.environ.get("SEED_SUPER_ADMIN_PHONE", "9999900001")
ADMIN_PASSWORD = os.environ.get("SEED_SUPER_ADMIN_PASSWORD", "ChangeThisPassword1")


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
    "phone": "9999900002", "fullName": "District Officer", "role": "DISTRICT_ADMIN",
    "districtId": shravasti["id"],
}, token=admin, expect=201)
ok("district officer invited")

_, schools = call("GET", "/schools?limit=10", token=admin, expect=200)
school = next(s for s in schools["items"] if s["udiseCode"] == "09460100101")
call("POST", "/users/invite", {
    "phone": "9999900003", "fullName": "Sunita Devi", "role": "PRINCIPAL", "schoolId": school["id"],
}, token=admin, expect=201)
ok("head teacher invited")

_, otp = call("POST", "/auth/otp/request", {"phone": "9999900004", "purpose": "REGISTRATION"}, expect=200)
call("POST", "/auth/register", {
    "phone": "9999900004", "code": otp["devCode"], "fullName": "Ram Prasad Verma",
    "udiseCode": "09460100101",
}, expect=201)
_, otp2 = call("POST", "/auth/otp/request", {"phone": "9999900004", "purpose": "LOGIN"}, expect=200)
call("POST", "/auth/otp/login", {"phone": "9999900004", "code": otp2["devCode"]}, expect=403)
ok("teacher self-registers and is blocked until approved")

_, otp3 = call("POST", "/auth/otp/request", {"phone": "9999900003"}, expect=200)
_, hs = call("POST", "/auth/otp/login", {"phone": "9999900003", "code": otp3["devCode"]}, expect=200)
head_token = hs["tokens"]["accessToken"]
_, pending = call("GET", "/users?status=PENDING_APPROVAL", token=head_token, expect=200)
call("POST", f"/users/{pending['items'][0]['id']}/approve", {}, token=head_token, expect=200)
ok("head teacher approves the registration")

_, otp4 = call("POST", "/auth/otp/request", {"phone": "9999900004"}, expect=200)
_, ts = call("POST", "/auth/otp/login", {"phone": "9999900004", "code": otp4["devCode"]}, expect=200)
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

_, otp5 = call("POST", "/auth/otp/request", {"phone": "9999900002"}, expect=200)
_, osess = call("POST", "/auth/otp/login", {"phone": "9999900002", "code": otp5["devCode"]}, expect=200)
officer_token = osess["tokens"]["accessToken"]

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
assert "Ram Kumar" not in raw and "9999900004" not in raw, raw
ok("showcase shows the given name, never the surname, guardian or phone")

_, rev = call("POST", f"/students/{student['id']}/consent/revoke",
              {"reason": "The family asked us to remove it."}, token=teacher, expect=200)
assert rev["unpublishedActivityCount"] == 1, rev
call("GET", f"/public/activities/{activity['id']}", expect=404)
ok("withdrawing consent pulls it off the open web immediately")

_, report = call("GET", "/reports/overview", token=officer_token, expect=200)
assert report["totals"]["publishedActivities"] == 1, report["totals"]
ok(f"district report: {report['totals']['publishedActivities']} published, "
   f"{report['participationRate']['schools']:.0%} of schools active")

status, _ = call("GET", "/reports/overview?districtId=" + districts["items"][0]["id"], token=officer_token)
assert status == 403, status
ok("officer refused a report for a district they do not administer")

print("End-to-end smoke test against a live server and PostgreSQL")
print("\n".join(steps))
print("\nAll steps passed.")
