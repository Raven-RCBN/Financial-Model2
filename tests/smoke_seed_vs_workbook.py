from __future__ import annotations

import json
from pathlib import Path

from openpyxl import load_workbook


ROOT = Path(__file__).resolve().parents[1]
WORKBOOK = Path("/Users/admin/Desktop/OPSL_Budget Requisition_Aug26_FINAL_10Aug26.xlsm")
DB = ROOT / "data" / "plantation-financial-model.db.json"
PROJECT_ID = "project_opsl_15000ha_development"

CHECKS = {
    "totalDevelopmentExpenditure": ("Summary (US$)", "F17"),
    "committedSources": ("Summary (US$)", "I10"),
    "fundingShortfall": ("Summary (US$)", "I14"),
    "costPerHa": ("Summary (US$)", "F29"),
    "nominalAfterTaxIrr": ("Summary (US$)", "I24"),
    "paybackYears": ("Summary (US$)", "I26"),
    "nominalAfterTaxNpvAtWacc": ("Summary (US$)", "I27"),
    "year1BudgetAmount": ("STATUS", "F5"),
    "netBudgetAvailable": ("STATUS", "F9"),
    "augCurrentCashBalance": ("OPSL AUG BUD req", "E8"),
}


def assert_close(name, workbook_value, db_value):
    tolerance = max(0.01, abs(float(workbook_value)) * 1e-10)
    delta = abs(float(workbook_value) - float(db_value))
    if delta > tolerance:
        raise AssertionError(
            f"{name} mismatch: workbook={workbook_value} database={db_value} delta={delta}"
        )
    return {"metric": name, "workbook": workbook_value, "database": db_value, "delta": delta}


def main():
    database = json.loads(DB.read_text())
    project = next(project for project in database["projects"] if project["id"] == PROJECT_ID)
    model = next(model for model in database["models"] if model["id"] == project["modelId"])
    workbook = load_workbook(WORKBOOK, data_only=True, read_only=True)
    results = []
    for metric, (sheet_name, address) in CHECKS.items():
        workbook_value = workbook[sheet_name][address].value
        db_value = model["metrics"][metric]
        results.append(assert_close(metric, workbook_value, db_value))

    scoped_collections = [
        "inputRecords",
        "inputTables",
        "formulaRules",
        "reportSnapshots",
        "reportTables",
        "transactions",
        "marketData",
    ]
    for collection in scoped_collections:
        missing = [
            item.get("id", "?")
            for item in database[collection]
            if item.get("companyId") != project["companyId"] or item.get("projectId") != PROJECT_ID
        ]
        if missing:
            raise AssertionError(f"{collection} has unscoped records: {missing[:5]}")

    print(
        json.dumps(
            {
                "status": "pass",
                "company": database["companies"][0]["name"],
                "project": project["name"],
                "checks": results,
                "scopedCollections": {
                    name: len(database[name]) for name in scoped_collections
                },
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
