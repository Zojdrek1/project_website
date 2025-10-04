import csv
import json
from pathlib import Path

def csv_to_json(csv_file, json_file):
    # Read the CSV
    with open(csv_file, mode="r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f, delimiter=";")
        rows = list(reader)

    # Convert numeric columns if possible
    for row in rows:
        for key, value in row.items():
            if value is None:
                continue
            v = value.strip()
            if v.replace(".", "", 1).isdigit():  # check float/int
                try:
                    if "." in v:
                        row[key] = float(v)
                    else:
                        row[key] = int(v)
                except:
                    row[key] = v

    # Write JSON
    with open(json_file, mode="w", encoding="utf-8") as f:
        json.dump(rows, f, indent=2, ensure_ascii=False)

    print(f"Converted {csv_file} → {json_file} ({len(rows)} records)")

if __name__ == "__main__":
    # Adjust these filenames as needed
    csv_path = Path("cards.csv")
    json_path = Path("cards.json")
    csv_to_json(csv_path, json_path)