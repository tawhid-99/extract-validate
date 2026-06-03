from typing import List, Dict, Any, Tuple
from datetime import datetime

def separate_by_eligibility(bidders: list) -> tuple:
    """
    Separates bidders into eligible, conditional, and ineligible lists.
    """
    eligible_bidders = [b for b in bidders if b.get('verdict') == 'ELIGIBLE']
    conditional_bidders = [b for b in bidders if b.get('verdict') == 'CONDITIONALLY ELIGIBLE']
    ineligible_bidders = [b for b in bidders if b.get('verdict') == 'NOT ELIGIBLE']
    
    return eligible_bidders, conditional_bidders, ineligible_bidders

def calculate_price_score(bid_price: float, eligible_prices: list) -> float:
    """
    Computes price score comparing to the minimum eligible price.
    Ineligible and conditional bidders do not participate.
    """
    if not eligible_prices:
        return 0.0
    min_price = min(eligible_prices)
    if bid_price <= 0.0:
        return 0.0
    return (min_price / bid_price) * 100.0

def calculate_final_score(compliance_score: float, price_score: float) -> float:
    """
    Calculates final weighted score (60% Compliance, 40% Price).
    """
    COMPLIANCE_WEIGHT = 0.60
    PRICE_WEIGHT      = 0.40

    return round(
        (compliance_score * COMPLIANCE_WEIGHT) + (price_score * PRICE_WEIGHT),
        2
    )

def rank_bidders(bidders: list) -> dict:
    """
    Main ranking orchestration: separate, score, sort, and rank bidders.
    """
    eligible, conditional, ineligible = separate_by_eligibility(bidders)

    # Step 1 — Rank ELIGIBLE bidders by final score
    eligible_prices = [b['bid_price'] for b in eligible]

    for bidder in eligible:
        bidder['price_score']  = calculate_price_score(bidder['bid_price'], eligible_prices)
        bidder['final_score']  = calculate_final_score(bidder['compliance_score'], bidder['price_score'])

    eligible_ranked = sorted(eligible, key=lambda x: x['final_score'], reverse=True)
    for i, b in enumerate(eligible_ranked):
        b['rank'] = i + 1
        b['rank_label'] = ':first_place_medal: WINNER' if i == 0 else f'#{i+1}'

    # Step 2 — Conditional bidders listed separately (not ranked against eligible)
    for b in conditional:
        b['rank'] = 'COND'
        b['rank_label'] = ':warning: CONDITIONAL'
        b['price_score'] = None
        b['final_score'] = None

    # Step 3 — Ineligible bidders listed last
    for b in ineligible:
        b['rank'] = 'NE'
        b['rank_label'] = ':x: NOT ELIGIBLE'
        b['price_score'] = None
        b['final_score'] = None

    return {
        "eligible_count":    len(eligible),
        "conditional_count": len(conditional),
        "ineligible_count":  len(ineligible),
        "winner":            eligible_ranked[0] if eligible_ranked else None,
        "ranked_eligible":   eligible_ranked,
        "conditional":       conditional,
        "ineligible":        ineligible,
        "all_ranked":        eligible_ranked + conditional + ineligible
    }

def generate_leaderboard(ranked: dict) -> str:
    """
    Generates a markdown leaderboard report from ranked bidder data.
    """
    dt_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    content = []
    content.append("# Bidder Evaluation Leaderboard")
    content.append(f"_Generated: {dt_str}_\n")

    # 1. Eligible Bidders
    content.append("## :white_check_mark: Eligible Bidders")
    if ranked["ranked_eligible"]:
        content.append("| Rank | Bidder | Compliance | Price Score | Final Score | Verdict |")
        content.append("|------|--------|------------|-------------|-------------|---------|")
        for b in ranked["ranked_eligible"]:
            label = b['rank_label']
            verdict_cell = ":white_check_mark: WINNER" if b['rank'] == 1 else ":white_check_mark: ELIGIBLE"
            content.append(f"| {label} | {b.get('name', 'Unknown')} | {b['compliance_score']:.1f} | {b['price_score']:.1f} | {b['final_score']:.1f} | {verdict_cell} |")
    else:
        content.append("No eligible bidders met all compliance criteria.\n")

    content.append("")

    # 2. Conditionally Eligible
    content.append("## :warning: Conditionally Eligible (Pending Clarification)")
    if ranked["conditional"]:
        content.append("| Bidder | Warnings | Blocking Clauses | Verdict |")
        content.append("|--------|----------|-----------------|---------|")
        for b in ranked["conditional"]:
            warn_count = b.get('warned', 0)
            blocking = ", ".join(b.get('blocking_clauses', []))
            content.append(f"| {b.get('name', 'Unknown')} | {warn_count} | {blocking} | :warning: CONDITIONAL |")
    else:
        content.append("No bidders are conditionally eligible.\n")

    content.append("")

    # 3. Not Eligible
    content.append("## :x: Not Eligible")
    if ranked["ineligible"]:
        content.append("| Bidder | Failed Clauses | Reason | Verdict |")
        content.append("|--------|---------------|--------|---------|")
        for b in ranked["ineligible"]:
            failed_clauses = ", ".join(b.get('blocking_clauses', []))
            # Join fail details missing messages
            reasons = ", ".join(c.get('missing') or c.get('reason') or 'Failed' for c in b.get('failed_details', []))
            content.append(f"| {b.get('name', 'Unknown')} | {failed_clauses} | {reasons} | :x: NOT ELIGIBLE |")
    else:
        content.append("No bidders were rejected as not eligible.\n")

    content.append("\n---")
    
    # Bottom Summary
    winner_name = ranked["winner"].get("name", "N/A") if ranked["winner"] else "None"
    winner_msg = f"{winner_name} — Meets all clauses, lowest compliant bid" if ranked["winner"] else "None — No eligible bidders found"
    content.append(f"**Winner:** {winner_msg}")
    
    total_eval = len(ranked["all_ranked"])
    content.append(f"**Total Evaluated:** {total_eval} bidders")
    
    content.append(f"**Eligible:** {ranked['eligible_count']} | **Conditional:** {ranked['conditional_count']} | **Not Eligible:** {ranked['ineligible_count']}")

    return "\n".join(content)
