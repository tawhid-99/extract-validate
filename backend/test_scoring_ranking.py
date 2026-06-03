import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.scoring import determine_verdict, calculate_compliance_score, evaluate_bidder
from backend.ranker import (
    separate_by_eligibility, 
    calculate_price_score, 
    calculate_final_score, 
    rank_bidders, 
    generate_leaderboard
)

def test_verdict_logic():
    print("Testing verdict logic...")
    
    # 1. All PASS
    results_pass = [
        {"clause_id": "C1", "status": "PASS", "category": "Legal", "clause_text": "text", "reason": "ok", "missing": None},
        {"clause_id": "C2", "status": "PASS", "category": "Compliance", "clause_text": "text", "reason": "ok", "missing": None}
    ]
    res1 = determine_verdict(results_pass)
    assert res1["verdict"] == "ELIGIBLE"
    assert res1["eligible"] is True

    # 2. One WARN, no FAIL
    results_warn = [
        {"clause_id": "C1", "status": "PASS", "category": "Legal", "clause_text": "text", "reason": "ok", "missing": None},
        {"clause_id": "C2", "status": "WARN", "category": "Compliance", "clause_text": "text", "reason": "warn", "missing": "docs"}
    ]
    res2 = determine_verdict(results_warn)
    assert res2["verdict"] == "CONDITIONALLY ELIGIBLE"
    assert res2["eligible"] is False
    assert "C2" in res2["blocking_clauses"]

    # 3. One FAIL
    results_fail = [
        {"clause_id": "C1", "status": "FAIL", "category": "Legal", "clause_text": "text", "reason": "fail", "missing": "cert"},
        {"clause_id": "C2", "status": "WARN", "category": "Compliance", "clause_text": "text", "reason": "warn", "missing": "docs"}
    ]
    res3 = determine_verdict(results_fail)
    assert res3["verdict"] == "NOT ELIGIBLE"
    assert res3["eligible"] is False
    assert "C1" in res3["blocking_clauses"]
    assert len(res3.get("failed_details", [])) == 1
    
    print("Verdict logic tests: PASSED")

def test_scoring_logic():
    print("Testing compliance scoring...")
    
    # Financial (weight 0.3) has 1 PASS (1.0 points)
    # Compliance (weight 0.25) has 1 WARN (0.5 points)
    # Legal (weight 0.20) has 1 FAIL (0.0 points)
    # Technical (weight 0.15) has 1 PASS (1.0 points)
    # Operational (weight 0.05) has 1 PASS (1.0 points)
    # Documentation (weight 0.05) has 1 PASS (1.0 points)
    results = [
        {"clause_id": "C1", "status": "PASS", "category": "Financial"},
        {"clause_id": "C2", "status": "WARN", "category": "Compliance"},
        {"clause_id": "C3", "status": "FAIL", "category": "Legal"},
        {"clause_id": "C4", "status": "PASS", "category": "Technical"},
        {"clause_id": "C5", "status": "PASS", "category": "Operational"},
        {"clause_id": "C6", "status": "PASS", "category": "Documentation"}
    ]
    
    # Financial category_score = (1 / 1) * 100 = 100
    # Compliance category_score = (0.5 / 1) * 100 = 50
    # Legal category_score = (0 / 1) * 100 = 0
    # Technical category_score = (1 / 1) * 100 = 100
    # Operational category_score = (1 / 1) * 100 = 100
    # Documentation category_score = (1 / 1) * 100 = 100
    #
    # Weighted Score = 100 * 0.3 + 50 * 0.25 + 0 * 0.2 + 100 * 0.15 + 100 * 0.05 + 100 * 0.05
    #                = 30 + 12.5 + 0 + 15 + 5 + 5 = 67.5
    score = calculate_compliance_score(results)
    assert abs(score - 67.5) < 0.01, f"Expected 67.5, got {score}"

    print("Compliance scoring tests: PASSED")

def test_ranking_logic():
    print("Testing ranking engine...")
    
    # Setup some evaluated bidders
    # Vendor A (Eligible): Compliance score 90, Price 150000
    # Vendor B (Eligible): Compliance score 95, Price 100000
    # Vendor C (Conditional): Compliance score 90, Price 90000
    # Vendor D (Ineligible): Compliance score 60, Price 80000
    
    bidders = [
        {
            "name": "Vendor A",
            "verdict": "ELIGIBLE",
            "eligible": True,
            "compliance_score": 90.0,
            "bid_price": 150000.0,
            "blocking_clauses": []
        },
        {
            "name": "Vendor B",
            "verdict": "ELIGIBLE",
            "eligible": True,
            "compliance_score": 95.0,
            "bid_price": 100000.0,
            "blocking_clauses": []
        },
        {
            "name": "Vendor C",
            "verdict": "CONDITIONALLY ELIGIBLE",
            "eligible": False,
            "compliance_score": 90.0,
            "bid_price": 90000.0,
            "blocking_clauses": ["C2"],
            "warned": 1,
            "warn_details": [{"clause_id": "C2", "missing": "ISO 9001 cert"}]
        },
        {
            "name": "Vendor D",
            "verdict": "NOT ELIGIBLE",
            "eligible": False,
            "compliance_score": 60.0,
            "bid_price": 80000.0,
            "blocking_clauses": ["C1"],
            "failed_details": [{"clause_id": "C1", "missing": "Sanctions check"}]
        }
    ]
    
    # separate
    eligible, conditional, ineligible = separate_by_eligibility(bidders)
    assert len(eligible) == 2
    assert len(conditional) == 1
    assert len(ineligible) == 1
    
    # rank
    ranked_dict = rank_bidders(bidders)
    assert ranked_dict["eligible_count"] == 2
    assert ranked_dict["conditional_count"] == 1
    assert ranked_dict["ineligible_count"] == 1
    
    # Price scoring:
    # min_price = min(150000, 100000) = 100000
    # Vendor A price score = (100000 / 150000) * 100 = 66.666...
    # Vendor B price score = (100000 / 100000) * 100 = 100.0
    # Final scoring:
    # Vendor A final score = 90.0 * 0.60 + 66.666... * 0.40 = 54.0 + 26.666... = 80.67
    # Vendor B final score = 95.0 * 0.60 + 100.0 * 0.40 = 57.0 + 40.0 = 97.00
    
    ranked_eligible = ranked_dict["ranked_eligible"]
    assert ranked_eligible[0]["name"] == "Vendor B"
    assert ranked_eligible[0]["rank"] == 1
    assert abs(ranked_eligible[0]["price_score"] - 100.0) < 0.01
    assert abs(ranked_eligible[0]["final_score"] - 97.00) < 0.01

    assert ranked_eligible[1]["name"] == "Vendor A"
    assert ranked_eligible[1]["rank"] == 2
    assert abs(ranked_eligible[1]["price_score"] - 66.67) < 0.05
    assert abs(ranked_eligible[1]["final_score"] - 80.67) < 0.05
    
    # Winner
    assert ranked_dict["winner"]["name"] == "Vendor B"
    
    # Leaderboard MD formatting check
    md = generate_leaderboard(ranked_dict)
    assert "# Bidder Evaluation Leaderboard" in md
    assert "Vendor B" in md
    assert "Vendor C" in md
    assert "Vendor D" in md
    assert "WINNER" in md
    assert "CONDITIONAL" in md
    assert "NOT ELIGIBLE" in md
    
    print("Ranking engine tests: PASSED")

if __name__ == "__main__":
    test_verdict_logic()
    test_scoring_logic()
    test_ranking_logic()
    print("All tests passed successfully!")
