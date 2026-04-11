import httpx
from app.core.config import settings


async def verify_gstin_api(gstin: str) -> dict:
    """Verify GSTIN via GSTN API or return mock data for dev."""
    gstin = gstin.upper().strip()

    # Validate format first
    import re
    if not re.match(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$", gstin):
        return {
            "gstin": gstin,
            "status": "INVALID",
            "error": "Invalid GSTIN format",
            "risk_score": 1.0,
        }

    # In production, call actual GSTN API
    if settings.GSTN_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(
                    f"{settings.GSTN_API_URL}/taxpayerapi/v2.0/taxpayers/{gstin}",
                    headers={"Authorization": f"Bearer {settings.GSTN_API_KEY}"},
                )
                if response.status_code == 200:
                    data = response.json()
                    return {
                        "gstin": gstin,
                        "business_name": data.get("tradeNam", "Unknown"),
                        "registration_date": data.get("rgdt"),
                        "status": data.get("sts", "Unknown"),
                        "business_type": data.get("ctb", "Unknown"),
                        "state": data.get("stj", "Unknown"),
                        "risk_score": _calculate_risk_score(data),
                    }
        except Exception:
            pass

    # Mock response for development/testing
    state_codes = {
        "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab",
        "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
        "10": "Bihar", "19": "West Bengal", "20": "Jharkhand", "21": "Odisha",
        "22": "Chattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
        "27": "Maharashtra", "29": "Karnataka", "32": "Kerala", "33": "Tamil Nadu",
        "36": "Telangana", "37": "Andhra Pradesh",
    }
    state_code = gstin[:2]
    pan = gstin[2:12]
    state = state_codes.get(state_code, f"State {state_code}")

    return {
        "gstin": gstin,
        "business_name": f"Business ({pan})",
        "registration_date": "2019-04-01",
        "status": "Active",
        "business_type": "Regular",
        "state": state,
        "risk_score": 0.2,
        "note": "Mock data — connect GSTN API for real verification",
    }


def _calculate_risk_score(gstn_data: dict) -> float:
    score = 0.0
    if gstn_data.get("sts") != "Active":
        score += 0.5
    if not gstn_data.get("rgdt"):
        score += 0.2
    return min(score, 1.0)
