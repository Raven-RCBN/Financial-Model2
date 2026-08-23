import json
import os
import urllib.parse
import urllib.request
from http.cookiejar import CookieJar


PROJECT_ID = "project_opsl_15000ha_development"
ROOT_URL = os.environ.get("FM2_BASE_URL", "http://127.0.0.1:4173").rstrip("/")
BASE_URL = f"{ROOT_URL}/api/projects/{PROJECT_ID}"
FORMULA_ID = "formula_opsl_aug_bud_req_c13"
TARGET_SHEET = "OPSL AUG BUD req"
TARGET_CELL = "C13"
OPENER = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(CookieJar()))


def login():
    data = urllib.parse.urlencode({
        "userid": os.environ.get("FM2_AUTH_USER", "finance"),
        "password": os.environ.get("FM2_AUTH_PASSWORD", "Finance@123"),
    }).encode("utf-8")
    request = urllib.request.Request(
        f"{ROOT_URL}/login",
        data=data,
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    OPENER.open(request, timeout=10).close()


def request_json(path="", method="GET", payload=None):
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=data,
        method=method,
        headers={"Content-Type": "application/json"},
    )
    with OPENER.open(request, timeout=10) as response:
        return json.load(response)


def report_cell(payload, sheet_name, address):
    table = next(table for table in payload["reportTables"] if table["sheetName"] == sheet_name)
    return next(cell["value"] for row in table["rows"] for cell in row["cells"] if cell["address"] == address)


def formula(payload, formula_id):
    return next(item for item in payload["formulaRules"] if item["id"] == formula_id)


def main():
    login()
    initial = request_json()
    original = formula(initial, FORMULA_ID)["formula"]
    try:
        changed = request_json(
            "/formula-publish",
            method="POST",
            payload={"id": FORMULA_ID, "formula": "=100+25", "approvedBy": "smoke"},
        )
        assert report_cell(changed, TARGET_SHEET, TARGET_CELL) == 125
        assert changed["calculationRun"]["updatedCells"] > 0
    finally:
        restored = request_json(
            "/formula-publish",
            method="POST",
            payload={"id": FORMULA_ID, "formula": original, "approvedBy": "smoke_restore"},
        )
    assert abs(float(report_cell(restored, TARGET_SHEET, TARGET_CELL)) - 2875) < 0.001
    assert formula(restored, FORMULA_ID)["calculationStatus"] == "calculated"
    print(json.dumps({
        "status": "pass",
        "formula": FORMULA_ID,
        "target": f"{TARGET_SHEET}!{TARGET_CELL}",
        "restoredValue": report_cell(restored, TARGET_SHEET, TARGET_CELL),
        "calculationRun": restored["calculationRun"],
    }, indent=2))


if __name__ == "__main__":
    main()
