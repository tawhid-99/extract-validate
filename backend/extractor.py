import os
import sys

# Allow package resolution when executing from backend/ directory
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import re
import pdfplumber
import docx
from typing import List, Dict, Any, Callable
from rapidfuzz import fuzz
from backend.ollama_client import OllamaClient

# Keywords used to determine if a text chunk is relevant to trade compliance,
# financial terms, logistics/operations, legal agreements, documentation, or technical requirements.
import re

# Short acronyms/words (exact word match only to avoid false positives like 'coo' matching 'cookies')
EXACT_KEYWORDS = [
    "l/c", "fee", "tax", "fob", "cif", "exw", "dap", "ddp", "cfr", "fca", "fas", 
    "bol", "coo", "nda", "bis", "ofac", "usd"
]

# Stem/prefix keywords (word must start with this stem)
PREFIX_KEYWORDS = [
    # Modals / Rule indicators
    "shall", "must", "requir", "obligat", "prohibit", "restrict",
    # General Compliance & Trade
    "complian", "regulat", "sanction", "embargo", "export", "import", "customs", 
    "tariff", "dut", "license", "permit", "clearance", "trade", "treaty", "audit", "investig",
    # Financial
    "payment", "credit", "currency", "price", "pricing", "invoice", "billing",
    "charge", "cost", "reimburse", "financial",
    # Operational & Logistics
    "deliver", "ship", "logist", "transit", "carrier", "freight", "port of",
    "lead time", "timeline", "delay", "force majeure", "incoterm",
    # Legal & Liability
    "liab", "indemn", "jurisdict", "disput", "arbitrat", "governing law",
    "warrant", "guarante", "breach", "terminat", "confidenti", "clause", "contract", "agreement",
    # Documentation
    "document", "paperwork", "packing list", "bill of lading", "declar", "manifest",
    # Technical & Quality
    "technic", "specif", "spec", "standard", "quality", "inspect", "test",
    "conformance"
]

exact_pattern = r"\b(?:" + "|".join(re.escape(k) for k in EXACT_KEYWORDS) + r")\b"
prefix_pattern = r"\b(?:" + "|".join(re.escape(k) for k in PREFIX_KEYWORDS) + r")"
combined_pattern = f"({exact_pattern})|({prefix_pattern})"
COMPLIANCE_REGEX = re.compile(combined_pattern, re.IGNORECASE)

def is_compliance_relevant(chunk_text: str) -> bool:
    """
    Checks if a chunk of text contains any keywords related to trade compliance,
    finance, operations, legal, documentation, or technical requirements.
    Uses regex word-boundaries to speed up local extraction without false positives.
    """
    return bool(COMPLIANCE_REGEX.search(chunk_text))


def parse_pdf(file_path: str) -> str:
    """
    Extracts text page by page from a PDF file.
    """
    text_parts = []
    with pdfplumber.open(file_path) as pdf:
        for page_num, page in enumerate(pdf.pages, 1):
            page_text = page.extract_text()
            if page_text:
                # Embed page reference hints inside the raw text
                text_parts.append(f"[Page {page_num}]\n{page_text}")
    return "\n\n".join(text_parts)

def parse_docx(file_path: str) -> str:
    """
    Extracts paragraphs from a Word document.
    """
    doc = docx.Document(file_path)
    text_parts = []
    for i, para in enumerate(doc.paragraphs, 1):
        if para.text.strip():
            text_parts.append(para.text)
    return "\n".join(text_parts)

def parse_txt(file_path: str) -> str:
    """
    Reads plain text.
    """
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read()

def extract_text_from_file(file_path: str) -> str:
    """
    Dispatches to appropriate parser based on file extension.
    """
    _, ext = os.path.splitext(file_path.lower())
    if ext == ".pdf":
        return parse_pdf(file_path)
    elif ext == ".docx":
        return parse_docx(file_path)
    elif ext == ".txt":
        return parse_txt(file_path)
    else:
        raise ValueError(f"Unsupported file format: {ext}")

def chunk_text(text: str, chunk_size_tokens: int = 300, overlap_tokens: int = 50) -> List[str]:
    """
    Chunks text using a word-based token approximation (1 token ≈ 0.75 words).
    Reduced to 300 tokens to speed up local CPU inference and avoid timeouts.
    """
    words = text.split()
    chunk_size = int(chunk_size_tokens * 0.75)
    overlap = int(overlap_tokens * 0.75)
    
    if len(words) <= chunk_size:
        return [text]
        
    chunks = []
    start = 0
    while start < len(words):
        end = min(start + chunk_size, len(words))
        chunk_words = words[start:end]
        chunks.append(" ".join(chunk_words))
        if end == len(words):
            break
        start += (chunk_size - overlap)
    return chunks

async def extract_clauses_from_chunks(
    chunks: List[str], 
    ollama_client: OllamaClient,
    progress_callback: Callable[[int, int, List[Dict[str, Any]]], Any] = None
) -> List[Dict[str, Any]]:
    """
    Queries Ollama to extract clauses from each text chunk, skipping chunks
    that do not contain any compliance keywords.
    """
    system_prompt = (
        "You are a trade compliance analyst. Extract every trade clause, rule, "
        "condition, restriction, obligation, and requirement from the text.\n"
        "Return ONLY a JSON object of this format:\n"
        "{\n"
        '  "clauses": [\n'
        '    {\n'
        '      "clause_id": "<unique_id>",\n'
        '      "raw_text": "<exact_clause_text>",\n'
        '      "source_hint": "<section_or_page>"\n'
        '    }\n'
        '  ]\n'
        "}\n"
        "Do NOT output the literal placeholder text '<exact_clause_text>' or '<unique_id>'. "
        "Return {\"clauses\": []} if no clauses found. No explanation, no markdown, only valid JSON."
    )
    
    all_clauses = []
    total_chunks = len(chunks)
    
    for i, chunk in enumerate(chunks, 1):
        # Apply pre-filtering optimization
        if not is_compliance_relevant(chunk):
            print(f"Chunk {i}/{total_chunks} does not contain compliance keywords. Skipping Ollama API call.")
            if progress_callback:
                await progress_callback(i, total_chunks, all_clauses)
            continue
            
        try:
            # We call llama3.2 with temperature 0.3 for extraction (per details)
            response = await ollama_client.generate_json(
                system_prompt=system_prompt,
                user_message=chunk,
                temperature=0.3
            )
            
            if isinstance(response, dict) and "clauses" in response:
                valid_clauses = []
                for clause in response["clauses"]:
                    if isinstance(clause, dict) and "raw_text" in clause:
                        valid_clauses.append({
                            "clause_id": clause.get("clause_id", f"CLAUSE-TEMP-{len(all_clauses)+1}"),
                            "raw_text": clause.get("raw_text", ""),
                            "source_hint": clause.get("source_hint", "")
                        })
                all_clauses.extend(valid_clauses)
        except Exception as e:
            # Log error and continue with remaining chunks rather than failing entirely
            print(f"Error extracting clauses from chunk {i}/{total_chunks}: {e}")
            
        if progress_callback:
            await progress_callback(i, total_chunks, all_clauses)
            
    return all_clauses

async def deduplicate_clauses(
    clauses: List[Dict[str, Any]], 
    ollama_client: OllamaClient, 
    threshold: float = 0.85
) -> List[Dict[str, Any]]:
    """
    Deduplicates clauses using Ollama sentence embeddings (bge-m3) & cosine similarity.
    Falls back to rapidfuzz ratio if embeddings fail or are blocked.
    Renumbers clause IDs sequentially after deduplication.
    """
    import math
    
    def cosine_similarity(v1: List[float], v2: List[float]) -> float:
        if not v1 or not v2:
            return 0.0
        dot_prod = sum(x * y for x, y in zip(v1, v2))
        mag1 = math.sqrt(sum(x * x for x in v1))
        mag2 = math.sqrt(sum(x * x for x in v2))
        if not mag1 or not mag2:
            return 0.0
        return dot_prod / (mag1 * mag2)

    unique_clauses = []
    for c in clauses:
        raw_text = c.get("raw_text", "").strip()
        if not raw_text:
            continue
        
        # Get embedding for current clause from local Ollama bge-m3 model
        emb = await ollama_client.get_embedding(raw_text)
        c["embedding"] = emb
        
        is_duplicate = False
        for u in unique_clauses:
            if emb and u.get("embedding"):
                sim = cosine_similarity(emb, u["embedding"])
                if sim >= threshold:
                    is_duplicate = True
                    break
            else:
                # Fallback to string fuzzy matching (threshold 85% mapped to 85.0 scale)
                sim_fuzzy = fuzz.ratio(raw_text.lower(), u["raw_text"].lower())
                if sim_fuzzy >= 85.0:
                    is_duplicate = True
                    break
                    
        if not is_duplicate:
            unique_clauses.append(c)
            
    # Clean up embeddings from clauses before returning
    for c in unique_clauses:
        if "embedding" in c:
            del c["embedding"]
            
    # Renumber sequentially
    for idx, c in enumerate(unique_clauses, 1):
        c["clause_id"] = f"CLAUSE-{idx:03d}"
        
    return unique_clauses
