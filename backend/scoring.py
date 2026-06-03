# VERDICT DECISION TREE:
#
# Has ANY FAIL?
#   YES → NOT ELIGIBLE (stop, do not compute rank or price score)
#   NO  ↓
#
# Has ANY WARN?
#   YES → CONDITIONALLY ELIGIBLE (stop, listed separately, not ranked)
#   NO  ↓
#
# All PASS?
#   YES → ELIGIBLE (compute compliance score + price score → rank)
#
# RANKING only happens among ELIGIBLE bidders.
# Price comparison only happens among ELIGIBLE bidders.
# One FAIL blocks everything. No exceptions.

from typing import List, Dict, Any

CATEGORY_WEIGHTS = {
    "Financial":     0.30,
    "Compliance":    0.25,
    "Legal":         0.20,
    "Technical":     0.15,
    "Operational":   0.05,
    "Documentation": 0.05
}

STATUS_POINTS = { "PASS": 1.0, "WARN": 0.5, "FAIL": 0.0 }

def determine_verdict(results: list) -> dict:
    """
    Evaluates clause results using a gate-based system.
    One FAIL = NOT ELIGIBLE.
    One WARN = CONDITIONALLY ELIGIBLE.
    All PASS = ELIGIBLE.
    """
    # Step 1 — Check for any FAIL
    fails = [r for r in results if r.get('status') == 'FAIL']
    if len(fails) > 0:
        return {
            "verdict": "NOT ELIGIBLE",
            "eligible": False,
            "reason": "Failed one or more required clauses",
            "blocking_clauses": [r['clause_id'] for r in fails],
            "failed_details": [
                {
                    "clause_id": r['clause_id'],
                    "clause_text": r.get('clause_text') or r.get('raw_text', ''),
                    "category": r.get('category', 'Compliance'),
                    "mandatory": r.get('mandatory', True),
                    "reason": r.get('reason', 'Clause check failed'),
                    "missing": r.get('missing', 'Not specified')
                }
                for r in fails
            ]
        }

    # Step 2 — Check for any WARN (no FAILs at this point)
    warns = [r for r in results if r.get('status') == 'WARN']
    if len(warns) > 0:
        return {
            "verdict": "CONDITIONALLY ELIGIBLE",
            "eligible": False,
            "reason": "Meets most clauses but some require clarification or additional documentation",
            "blocking_clauses": [r['clause_id'] for r in warns],
            "warn_details": [
                {
                    "clause_id": r['clause_id'],
                    "clause_text": r.get('clause_text') or r.get('raw_text', ''),
                    "category": r.get('category', 'Compliance'),
                    "reason": r.get('reason', 'Clause requirements not fully clear'),
                    "missing": r.get('missing', 'Not specified')
                }
                for r in warns
            ]
        }

    # Step 3 — All PASS
    return {
        "verdict": "ELIGIBLE",
        "eligible": True,
        "reason": "Meets all required clauses",
        "blocking_clauses": [],
        "total_clauses_passed": len(results)
    }

def calculate_compliance_score(results: list) -> float:
    """
    Calculates the category-weighted compliance score (0-100).
    Only used to rank ELIGIBLE bidders against each other.
    """
    if not results:
        return 0.0

    # Group results by category
    category_results: Dict[str, List[Dict[str, Any]]] = {}
    for r in results:
        cat = r.get('category', 'Compliance')
        if cat not in category_results:
            category_results[cat] = []
        category_results[cat].append(r)

    weighted_score = 0.0
    total_weight = 0.0

    for cat, cat_res in category_results.items():
        if not cat_res:
            continue
        weight = CATEGORY_WEIGHTS.get(cat, 0.0)
        points = sum(STATUS_POINTS.get(r.get('status', 'WARN'), 0.5) for r in cat_res)
        category_score = (points / len(cat_res)) * 100.0
        weighted_score += category_score * weight
        total_weight += weight

    if total_weight > 0.0:
        # Scale to 100 based on present category weights
        weighted_score = weighted_score / total_weight
    else:
        weighted_score = 0.0

    return round(float(weighted_score), 2)

def evaluate_bidder(results: list, bid_price: float) -> dict:
    """
    Main entry point to evaluate a bidder's compliance results and bid price.
    """
    verdict_result = determine_verdict(results)
    compliance_score = calculate_compliance_score(results)

    # Group category breakdown
    category_results: Dict[str, List[Dict[str, Any]]] = {}
    for r in results:
        cat = r.get('category', 'Compliance')
        if cat not in category_results:
            category_results[cat] = []
        category_results[cat].append(r)

    category_breakdown = {}
    for cat in CATEGORY_WEIGHTS:
        cat_res = category_results.get(cat, [])
        if cat_res:
            points = sum(STATUS_POINTS.get(r.get('status', 'WARN'), 0.5) for r in cat_res)
            cat_score = (points / len(cat_res)) * 100.0
            p_count = sum(1 for r in cat_res if r.get('status') == 'PASS')
            w_count = sum(1 for r in cat_res if r.get('status') == 'WARN')
            f_count = sum(1 for r in cat_res if r.get('status') == 'FAIL')
        else:
            cat_score = 0.0
            p_count = 0
            w_count = 0
            f_count = 0

        category_breakdown[cat] = {
            "score": round(cat_score, 1),
            "pass": p_count,
            "warn": w_count,
            "fail": f_count
        }

    return {
        "verdict":           verdict_result['verdict'],
        "eligible":          verdict_result['eligible'],
        "reason":            verdict_result['reason'],
        "blocking_clauses":  verdict_result['blocking_clauses'],
        "failed_details":    verdict_result.get('failed_details', []),
        "warn_details":      verdict_result.get('warn_details', []),
        "compliance_score":  compliance_score,
        "bid_price":         bid_price,
        "total_clauses":     len(results),
        "passed":            len([r for r in results if r.get('status') == 'PASS']),
        "warned":            len([r for r in results if r.get('status') == 'WARN']),
        "failed":            len([r for r in results if r.get('status') == 'FAIL']),
        "category_breakdown": category_breakdown,
        "clause_results":    results
    }
