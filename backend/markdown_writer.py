import os
import re
from datetime import datetime
from typing import List, Dict, Any

# Resolve output directories relative to project root
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_CLAUSES_DIR = os.path.join(BASE_DIR, "output", "clauses")
OUTPUT_REPORTS_DIR = os.path.join(BASE_DIR, "output", "reports")

# Ensure output directories exist
os.makedirs(OUTPUT_CLAUSES_DIR, exist_ok=True)
os.makedirs(OUTPUT_REPORTS_DIR, exist_ok=True)

def write_clauses_to_markdown(document_name: str, clauses: List[Dict[str, Any]]) -> str:
    """
    Saves extracted + classified clauses to: output/clauses/{document_name}_{timestamp}.md
    Returns the absolute path to the created file.
    """
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    # Clean document name for file system
    clean_doc_name = re.sub(r"[^\w\-_\.]", "_", document_name)
    file_name = f"{clean_doc_name}_{timestamp}.md"
    file_path = os.path.join(OUTPUT_CLAUSES_DIR, file_name)
    
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    content = []
    content.append(f"# Trade Clauses — {document_name}")
    content.append(f"_Extracted: {now_str} | Total: {len(clauses)} clauses_\n")
    content.append("---")
    
    for c in clauses:
        clause_id = c.get("clause_id", "")
        category = c.get("category", "")
        confidence = c.get("confidence", 0.0)
        raw_text = c.get("raw_text", "")
        source_hint = c.get("source_hint", "Not specified")
        reasoning = c.get("reasoning", "")
        
        content.append(f"\n## {clause_id} | {category}")
        content.append(f"**Confidence:** {confidence}")
        content.append(f"**Rule:** {raw_text}")
        content.append(f"**Source:** {source_hint}")
        content.append(f"**Reasoning:** {reasoning}\n")
        content.append("---")
        
    with open(file_path, "w", encoding="utf-8") as f:
        f.write("\n".join(content))
        
    return file_path

def read_clauses_from_markdown(file_path: str) -> List[Dict[str, Any]]:
    """
    Parses a saved clause Markdown file back into a list of structured clauses.
    """
    if not os.path.exists(file_path):
        # Check if it's just a filename and look in OUTPUT_CLAUSES_DIR
        if not os.path.isabs(file_path):
            file_path = os.path.join(OUTPUT_CLAUSES_DIR, file_path)
            
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
        
    # Regex to parse the fields from each clause block.
    # Note: re.DOTALL allows matching newlines inside rule text.
    # Clause heading: ## CLAUSE-001 | Category
    # Details: **Confidence:** X, **Rule:** Y, **Source:** Z, **Reasoning:** W
    pattern = (
        r"##\s+(CLAUSE-\d+)\s*\|\s*([^\n]+)\n"
        r"\*\*Confidence:\*\*\s*([^\n]*)\n"
        r"\*\*Rule:\*\*\s*(.*?)\n"
        r"\*\*Source:\*\*\s*(.*?)\n"
        r"\*\*Reasoning:\*\*\s*(.*?)(?=\n---|\Z)"
    )
    
    matches = re.finditer(pattern, content, re.DOTALL)
    
    clauses = []
    for match in matches:
        clause_id = match.group(1).strip()
        category = match.group(2).strip()
        confidence_str = match.group(3).strip()
        rule = match.group(4).strip()
        source = match.group(5).strip()
        reasoning = match.group(6).strip()
        
        try:
            confidence = float(confidence_str)
        except ValueError:
            confidence = 1.0
            
        clauses.append({
            "clause_id": clause_id,
            "category": category,
            "confidence": confidence,
            "raw_text": rule,
            "source_hint": source,
            "reasoning": reasoning
        })
        
    return clauses

def write_validation_report_to_markdown(
    client_name: str,
    source_clause_file: str,
    results: List[Dict[str, Any]],
    summary: Dict[str, Any]
) -> str:
    """
    Saves a trade validation report to: output/reports/{client_name}_{timestamp}.md
    Returns the absolute path to the created file.
    """
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    clean_client_name = re.sub(r"[^\w\-_\.]", "_", client_name)
    file_name = f"{clean_client_name}_{timestamp}.md"
    file_path = os.path.join(OUTPUT_REPORTS_DIR, file_name)
    
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    content = []
    content.append("# Trade Validation Report")
    content.append(f"**Client:** {client_name}")
    content.append(f"**Date:** {now_str}")
    content.append(f"**Document:** {os.path.basename(source_clause_file)}")
    content.append(f"**Score:** {summary['score']}/100")
    content.append(f"**Verdict:** {summary['verdict']}\n")
    content.append("---")
    content.append("\n## Clause-by-Clause Results")
    
    for r in results:
        clause_id = r.get("clause_id", "")
        status = r.get("status", "")
        category = r.get("category", "Unclassified")
        rule = r.get("raw_text", "")
        reason = r.get("reason", "")
        missing = r.get("missing", None)
        
        content.append(f"\n### {clause_id} — {status}")
        content.append(f"**Category:** {category}")
        content.append(f"**Clause:** {rule}")
        content.append(f"**Result:** {reason}")
        if status != "PASS":
            content.append(f"**Missing:** {missing or 'Not specified'}")
        else:
            content.append(f"**Missing:** None")
        content.append("\n---")
        
    content.append("\n## Summary")
    content.append(f"- Total clauses: {summary['total']}")
    content.append(f"- Passed: {summary['passed']}")
    content.append(f"- Warnings: {summary['warnings']}")
    content.append(f"- Failed: {summary['failed']}")
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write("\n".join(content))
        
    return file_path

def read_validation_report_from_markdown(file_path: str) -> Dict[str, Any]:
    """
    Parses a validation report Markdown file back into a structured dictionary.
    """
    if not os.path.exists(file_path):
        if not os.path.isabs(file_path):
            file_path = os.path.join(OUTPUT_REPORTS_DIR, file_path)
            
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
        
    # Parse basic metadata
    client_match = re.search(r"\*\*Client:\*\*\s*(.*)", content)
    date_match = re.search(r"\*\*Date:\*\*\s*(.*)", content)
    doc_match = re.search(r"\*\*Document:\*\*\s*(.*)", content)
    score_match = re.search(r"\*\*Score:\*\*\s*([\d\.]+)/100", content)
    verdict_match = re.search(r"\*\*Verdict:\*\*\s*(.*)", content)
    
    client_name = client_match.group(1).strip() if client_match else "Unknown"
    date_str = date_match.group(1).strip() if date_match else ""
    document_name = doc_match.group(1).strip() if doc_match else ""
    score = float(score_match.group(1).strip()) if score_match else 0.0
    verdict = verdict_match.group(1).strip() if verdict_match else "NOT ELIGIBLE"
    
    # Parse clauses from validation report
    # Heading: ### CLAUSE-001 — PASS
    # Details: **Category:** A, **Clause:** B, **Result:** C, **Missing:** D
    clause_pattern = (
        r"###\s+(CLAUSE-\d+)\s*—\s*([A-Z]+)\n"
        r"\*\*Category:\*\*\s*([^\n]*)\n"
        r"\*\*Clause:\*\*\s*(.*?)\n"
        r"\*\*Result:\*\*\s*(.*?)\n"
        r"\*\*Missing:\*\*\s*(.*?)(?=\n---|\Z)"
    )
    
    matches = re.finditer(clause_pattern, content, re.DOTALL)
    results = []
    passed = 0
    warnings = 0
    failed = 0
    
    for match in matches:
        clause_id = match.group(1).strip()
        status = match.group(2).strip()
        category = match.group(3).strip()
        rule = match.group(4).strip()
        reason = match.group(5).strip()
        missing = match.group(6).strip()
        
        if status == "PASS":
            passed += 1
        elif status == "WARN":
            warnings += 1
        elif status == "FAIL":
            failed += 1
            
        results.append({
            "clause_id": clause_id,
            "status": status,
            "category": category,
            "raw_text": rule,
            "reason": reason,
            "missing": None if missing.lower() == "none" else missing
        })
        
    return {
        "client_name": client_name,
        "date": date_str,
        "source_clause_file": document_name,
        "score": score,
        "verdict": verdict,
        "results": results,
        "summary": {
            "total": len(results),
            "passed": passed,
            "warnings": warnings,
            "failed": failed
        }
    }
