from datetime import date, datetime
from typing import Tuple, Optional
import re

FY_MONTHS = [
    (4, "April"), (5, "May"), (6, "June"),
    (7, "July"), (8, "August"), (9, "September"),
    (10, "October"), (11, "November"), (12, "December"),
    (1, "January"), (2, "February"), (3, "March"),
]


def get_financial_year(dt: date) -> str:
    """Return FY string like '2024-25' for a given date."""
    if dt.month >= 4:
        return f"{dt.year}-{str(dt.year + 1)[2:]}"
    else:
        return f"{dt.year - 1}-{str(dt.year)[2:]}"


def get_financial_year_from_date(dt: date) -> str:
    return get_financial_year(dt)


def get_fy_and_quarter(dt: date) -> Tuple[str, int]:
    fy = get_financial_year(dt)
    month = dt.month
    if month in [4, 5, 6]:
        quarter = 1
    elif month in [7, 8, 9]:
        quarter = 2
    elif month in [10, 11, 12]:
        quarter = 3
    else:
        quarter = 4
    return fy, quarter


def parse_date_to_fy(date_str: str) -> Tuple[str, Optional[int], Optional[int]]:
    """Parse a date string and return (FY, month, year)."""
    formats = [
        "%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y",
        "%Y-%m-%d", "%d %b %Y", "%d %B %Y",
    ]
    dt = None
    for fmt in formats:
        try:
            dt = datetime.strptime(date_str.strip(), fmt).date()
            break
        except ValueError:
            continue

    if not dt:
        # Try to extract year/month with regex
        m = re.search(r"(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})", date_str)
        if m:
            try:
                d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
                if y < 100:
                    y += 2000
                dt = date(y, mo, d)
            except Exception:
                pass

    if not dt:
        return "2024-25", None, None

    return get_financial_year(dt), dt.month, dt.year


def get_gst_deadlines(financial_year: str):
    """Return GST filing deadlines for all months of a FY."""
    fy_parts = financial_year.split("-")
    start_year = int(f"20{fy_parts[0][2:]}") if len(fy_parts[0]) == 4 else int(fy_parts[0])
    deadlines = []

    for month_num, month_name in FY_MONTHS:
        year = start_year if month_num >= 4 else start_year + 1
        gstr1_day = 11
        gstr3b_day = 20

        deadlines.append({
            "month": month_num,
            "month_name": month_name,
            "year": year,
            "gstr1_due": f"{year}-{month_num:02d}-{gstr1_day:02d}",
            "gstr3b_due": f"{year}-{month_num:02d}-{gstr3b_day:02d}",
        })

    return deadlines
