import os
import sys

# Allow package resolution when executing from backend/ directory
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import logging
from typing import Dict, Any
from backend.ollama_client import OllamaClient

logger = logging.getLogger(__name__)

VALID_CATEGORIES = {
    "Financial",
    "Compliance",
    "Operational",
    "Legal",
    "Documentation",
    "Technical"
}

async def classify_clause(clause_text: str, ollama_client: OllamaClient) -> Dict[str, Any]:
    """
    Classifies a clause into one of 6 compliance categories using Ollama llama3.2.
    """
    system_prompt = (
        "You are a trade compliance classifier. Classify the given trade clause "
        "into exactly ONE of these categories:\n"
        "- Financial: payment terms, minimum values, credit requirements, pricing conditions\n"
        "- Compliance: certifications, standards, regulatory requirements, licenses\n"
        "- Operational: timelines, logistics, delivery, shipment, lead times\n"
        "- Legal: sanctions, jurisdiction, dispute resolution, liability, OFAC\n"
        "- Documentation: required paperwork, invoices, certificates of origin\n"
        "- Technical: product specs, quality standards, testing requirements\n\n"
        "Respond ONLY with a JSON object:\n"
        "{\n"
        '  "category": "<one of the 6 categories>",\n'
        '  "confidence": <float 0.0-1.0>,\n'
        '  "reasoning": "<one sentence>"\n'
        "}\n"
        "No explanation, no markdown, only valid JSON."
    )
    
    user_msg = f"Classify this clause: {clause_text}"
    
    try:
        # Temperature 0.1 for deterministic classification (per details)
        response = await ollama_client.generate_json(
            system_prompt=system_prompt,
            user_message=user_msg,
            temperature=0.1
        )
        
        if isinstance(response, dict):
            category = response.get("category", "").strip()
            # Normalize casing
            category_cap = category.capitalize()
            
            # Find category if it's slightly malformed but matches
            matched_category = None
            for valid_cat in VALID_CATEGORIES:
                if category_cap == valid_cat or valid_cat.lower() in category.lower():
                    matched_category = valid_cat
                    break
            
            if matched_category:
                return {
                    "category": matched_category,
                    "confidence": float(response.get("confidence", 0.7)),
                    "reasoning": response.get("reasoning", "Classified successfully.")
                }
            else:
                logger.warning(f"Ollama returned invalid category '{category}'. Falling back to Compliance.")
                
    except Exception as e:
        logger.error(f"Error classifying clause '{clause_text[:40]}...': {e}")
        
    # Fallback response
    return {
        "category": "Compliance",
        "confidence": 0.5,
        "reasoning": "Fallback classification due to parsing or processing error."
    }
