import argparse
import csv
from pathlib import Path


KEEP_COLUMNS = [
    "AFFGEOID",
    "D_Wht_prob",
    "R_Wht_prob",
    "O_Wht_prob",
    "N_Wht_prob",
    "D_His_prob",
    "R_His_prob",
    "O_His_prob",
    "N_His_prob",
    "D_Blk_prob",
    "R_Blk_prob",
    "O_Blk_prob",
    "N_Blk_prob",
    "D_Asn_prob",
    "R_Asn_prob",
    "O_Asn_prob",
    "N_Asn_prob",
    "D_Oth_prob",
    "R_Oth_prob",
    "O_Oth_prob",
    "N_Oth_prob",
]


def _round_prob(value: str) -> str:
    """Round probability columns to 3 decimals.

    The browser renders these as choropleth colours, so full float64
    precision is wasted bytes: at 16 significant digits the output CSV is
    ~97 MiB -- a slow page load, and close to GitHub's 100 MiB per-file
    limit. Rounding to 3 dp takes it to ~33 MiB with no visible difference.
    """
    try:
        return f"{float(value):.3f}"
    except (TypeError, ValueError):
        return value


def reduce_csv(input_path: Path, output_path: Path) -> None:
    with input_path.open("r", newline="", encoding="utf-8") as infile:
        reader = csv.DictReader(infile)
        if not reader.fieldnames:
            raise ValueError("Input CSV has no header row.")

        missing = [col for col in KEEP_COLUMNS if col not in reader.fieldnames]
        if missing:
            raise ValueError(f"Missing required columns: {', '.join(missing)}")

        output_path.parent.mkdir(parents=True, exist_ok=True)
        with output_path.open("w", newline="", encoding="utf-8") as outfile:
            writer = csv.DictWriter(outfile, fieldnames=KEEP_COLUMNS)
            writer.writeheader()
            for row in reader:
                writer.writerow(
                    {col: _round_prob(row.get(col, "")) for col in KEEP_COLUMNS}
                )


def main() -> None:
    parser = argparse.ArgumentParser(description="Reduce map CSV to required columns.")
    parser.add_argument(
        "--input",
        default="assets/data/ny_estimates.csv",
        help="Path to the full input CSV.",
    )
    parser.add_argument(
        "--output",
        default="assets/data/ny_estimates_min.csv",
        help="Path to the reduced output CSV.",
    )
    args = parser.parse_args()
    reduce_csv(Path(args.input), Path(args.output))


if __name__ == "__main__":
    main()
