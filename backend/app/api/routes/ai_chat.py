"""
AI Chat Proxy — proxies requests to Anthropic API server-side
so the API key is never exposed in the browser.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List
import httpx

from app.core.config import settings
from app.core.security import get_current_user
from app.models.models import User

router = APIRouter(prefix="/ai", tags=["AI"])


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]


@router.post("/chat")
async def ai_chat(
    req: ChatRequest,
    current_user: User = Depends(get_current_user)
):
    api_key = settings.ANTHROPIC_API_KEY
    if not api_key:
        raise HTTPException(503, "AI service not configured. Set ANTHROPIC_API_KEY in environment.")

    payload = {
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 1024,
        "system": (
            "You are a professional CA (Chartered Accountant) assistant for Ajit Joshi Finance Services. "
            "You specialise in Indian taxation and accounting including GST (CGST/SGST/IGST), TDS sections, "
            "ITR forms (ITR-1 to ITR-7), ICAI accounting standards, Companies Act 2013, Income Tax Act 1961, "
            "GST Act 2017, and bookkeeping. Give clear, concise, practical answers. "
            "Always mention relevant sections, forms, or deadlines where applicable. "
            "If asked about calculations, show step-by-step working. "
            "Use Indian Rupee (₹) for monetary values."
        ),
        "messages": [{"role": m.role, "content": m.content} for m in req.messages],
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json=payload,
            )
        if response.status_code != 200:
            raise HTTPException(502, f"AI API error: {response.text[:200]}")
        data = response.json()
        reply = data.get("content", [{}])[0].get("text", "No response from AI.")
        return {"reply": reply}
    except httpx.TimeoutException:
        raise HTTPException(504, "AI request timed out. Please try again.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, f"AI service error: {str(e)}")
