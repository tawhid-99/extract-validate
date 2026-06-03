import sys
import os

# Append current directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from backend.ollama_client import OllamaClient
    from backend.extractor import extract_text_from_file, chunk_text, deduplicate_clauses
    from backend.classifier import classify_clause
    from backend.validator import validate_clause, calculate_verdict
    from backend.markdown_writer import write_clauses_to_markdown, read_clauses_from_markdown
    from backend.main import app

    print("Success: All backend imports loaded successfully!")
except Exception as e:
    print(f"Error loading backend imports: {e}")
    sys.exit(1)
