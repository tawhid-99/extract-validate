import os
import sys

# Allow package resolution when executing from backend/ directory
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import logging
from typing import Dict, Any, List
from backend.ollama_client import OllamaClient

logger = logging.getLogger(__name__)

async def validate_clause(
    clause_id: str,
    clause_text: str,
    client_requirements_text: str,
    ollama_client: OllamaClient
) -> Dict[str, Any]:
    """
    Validates a single clause against client requirements.
    """
    system_prompt = (
        "You are a trade compliance validator. Check whether the client "
        "requirements satisfy the given trade clause.\n\n"
        "Respond ONLY with a JSON object:\n"
        "{\n"
        f'  "clause_id": "{clause_id}",\n'
        '  "status": "PASS" | "FAIL" | "WARN",\n'
        '  "reason": "<one sentence explanation>",\n'
        '  "missing": "<what is missing, or null if PASS>"\n'
        "}\n\n"
        "PASS = requirement clearly satisfies the clause\n"
        "WARN = partially met, unclear, or conditional\n"
        "FAIL = clearly not met\n"
        "No explanation, no markdown, only valid JSON."
    )
    
    user_msg = (
        f"CLAUSE: {clause_text}\n"
        f"CLIENT REQUIREMENTS:\n{client_requirements_text}"
    )
    
    try:
        # Use temperature 0.1 for validation logic consistency
        response = await ollama_client.generate_json(
            system_prompt=system_prompt,
            user_message=user_msg,
            temperature=0.1
        )
        
        if isinstance(response, dict):
            status = response.get("status", "WARN").strip().upper()
            if status not in {"PASS", "FAIL", "WARN"}:
                status = "WARN"
            return {
                "clause_id": clause_id,
                "status": status,
                "reason": response.get("reason", "Validation processed."),
                "missing": response.get("missing", None) if status != "PASS" else None
            }
    except Exception as e:
        logger.error(f"Error validating clause {clause_id}: {e}")
        
    return {
        "clause_id": clause_id,
        "status": "WARN",
        "reason": f"Validation failed to execute due to system error: {str(e)}",
        "missing": "System connection error"
    }

def format_structured_requirements(req: Dict[str, Any]) -> str:
    """
    Utility to format a structured dict of client requirements into a clean text representation.
    """
    lines = []
    if "client_name" in req:
        lines.append(f"Client Name: {req['client_name']}")
    if "trade_type" in req:
        lines.append(f"Trade Type: {req['trade_type']}")
    if "transaction_value" in req:
        lines.append(f"Transaction Value: {req['transaction_value']}")
    if "origin_country" in req:
        lines.append(f"Origin Country: {req['origin_country']}")
        
    # Certifications
    certs = req.get("certifications", [])
    if isinstance(certs, list):
        certs_str = ", ".join(certs)
    else:
        certs_str = str(certs)
    if certs_str:
        lines.append(f"Certifications Held: {certs_str}")
        
    if "payment_method" in req:
        lines.append(f"Payment Method: {req['payment_method']}")
    if "lead_time_days" in req:
        lines.append(f"Lead Time Available: {req['lead_time_days']} days")
    if "product_category" in req:
        lines.append(f"Product Category: {req['product_category']}")
        
    sanctions_clean = req.get("sanctions_clean")
    if sanctions_clean is not None:
        status_str = "No active sanctions (Clean)" if sanctions_clean else "Active sanctions exist / OFAC flag"
        lines.append(f"Sanctions Status: {status_str}")
        
    # Add any other fields
    for k, v in req.items():
        if k not in {
            "client_name", "trade_type", "transaction_value", "origin_country", 
            "certifications", "payment_method", "lead_time_days", "product_category", 
            "sanctions_clean"
        } and v is not None:
            lines.append(f"{k.replace('_', ' ').title()}: {v}")
            
    return "\n".join(lines)

def calculate_verdict(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Computes points and returns eligibility details.
    - PASS = 1.0 points
    - WARN = 0.5 points
    - FAIL = 0.0 points
    - Score = (total points / total clauses) * 100
    """
    total = len(results)
    if total == 0:
        return {
            "score": 0.0,
            "verdict": "NOT ELIGIBLE",
            "passed": 0,
            "warnings": 0,
            "failed": 0
        }
        
    passed = 0
    warnings = 0
    failed = 0
    points = 0.0
    
    for r in results:
        status = r["status"]
        if status == "PASS":
            passed += 1
            points += 1.0
        elif status == "WARN":
            warnings += 1
            points += 0.5
        elif status == "FAIL":
            failed += 1
            points += 0.0
            
    score = (points / total) * 100.0
    
    if score >= 85.0:
        verdict = "ELIGIBLE"
    elif score >= 60.0:
        verdict = "CONDITIONALLY ELIGIBLE"
    else:
        verdict = "NOT ELIGIBLE"
        
    return {
        "score": round(score, 1),
        "verdict": verdict,
        "passed": passed,
        "warnings": warnings,
        "failed": failed,
        "total": total
    }
