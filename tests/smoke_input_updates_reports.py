from __future__ import annotations

import json
import urllib.request


BASE_URL = "http://127.0.0.1:4173"
PROJECT_ID = "project_opsl_15000ha_development"


def request_json(path, method="GET", body=None):
    data = None
    headers = {"Content-Type": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
    request = urllib.request.Request(f"{BASE_URL}{path}", data=data, method=method, headers=headers)
    with urllib.request.urlopen(request, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))


def report_table(payload, sheet_name):
    return next(table for table in payload["reportTables"] if table["sheetName"] == sheet_name)


def worksheet_cell(table, address):
    for row in table["rows"]:
        for cell in row.get("cells", []):
            if cell["address"] == address:
                return cell["value"]
    raise AssertionError(f"{table['sheetName']}!{address} not found")


def schedule_total(table, label):
    for row in table["rows"]:
        if row.get("label") == label:
            return row.get("total")
    raise AssertionError(f"{table['sheetName']} row {label!r} not found")


def assert_close(label, actual, expected):
    actual = float(actual)
    expected = float(expected)
    tolerance = max(0.01, abs(expected) * 1e-10)
    if abs(actual - expected) > tolerance:
        raise AssertionError(f"{label} expected {expected} got {actual}")


def update_input(input_record, value):
    return request_json(
        f"/api/projects/{PROJECT_ID}/inputs",
        method="PUT",
        body={
            "id": input_record["id"],
            "value": value,
            "metricKey": input_record.get("metricKey"),
            "settingKey": input_record.get("settingKey"),
        },
    )


def main():
    payload = request_json(f"/api/projects/{PROJECT_ID}")
    checks = [
        {
            "metricKey": "nominalAfterTaxNpvAtWacc",
            "delta": 123456.78,
            "worksheet": ("Summary (US$)", "I27"),
            "schedule": ("Valuation", "NPV (27 Yrs)"),
        },
        {
            "metricKey": "nominalAfterTaxIrr",
            "delta": 0.01,
            "worksheet": ("Summary (US$)", "I24"),
            "schedule": ("Valuation", "Using IRR function (27 Yrs)"),
        },
        {
            "metricKey": "paybackYears",
            "delta": 0.25,
            "worksheet": ("Summary (US$)", "I26"),
            "schedule": ("Valuation", "Payback period"),
        },
        {
            "metricKey": "augCurrentCashBalance",
            "delta": 25000,
        },
    ]
    originals = {}
    try:
        for check in checks:
            target = next(record for record in payload["inputRecords"] if record.get("metricKey") == check["metricKey"])
            original = float(target["value"])
            originals[check["metricKey"]] = (target, original)
            changed = original + check["delta"]
            changed_payload = update_input(target, changed)
            assert_close(f"{check['metricKey']} model metric", changed_payload["model"]["metrics"][check["metricKey"]], changed)

            if "worksheet" in check:
                sheet_name, address = check["worksheet"]
                table = report_table(changed_payload, sheet_name)
                assert_close(f"{sheet_name}!{address}", worksheet_cell(table, address), changed)

            if "schedule" in check:
                schedule_name, label = check["schedule"]
                table = report_table(changed_payload, schedule_name)
                assert_close(f"{schedule_name} / {label}", schedule_total(table, label), changed)

        for metric_key, (target, original) in originals.items():
            restored_payload = update_input(target, original)
            assert_close(f"restored {metric_key}", restored_payload["model"]["metrics"][metric_key], original)
    finally:
        for target, original in originals.values():
            update_input(target, original)

    print(
        json.dumps(
            {
                "status": "pass",
                "changedMetrics": [check["metricKey"] for check in checks],
                "linkedReportChecks": [
                    "Summary (US$)!I27",
                    "Summary (US$)!I24",
                    "Summary (US$)!I26",
                    "Valuation / NPV (27 Yrs)",
                    "Valuation / Using IRR function (27 Yrs)",
                    "Valuation / Payback period",
                ],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
