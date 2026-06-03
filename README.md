# TradeGuard AI: Trade Compliance Document Processing System

An automated, local-first compliance system that parses large trade policies, agreement documents, or terms (up to 350 pages in PDF, DOCX, or TXT formats) and extracts compliance constraints. The system categorizes rules using a local instance of the **llama3.2** LLM, and validates client trade criteria against rules to render audit verdicts and eligibility scores.

---

## Key Features

1. **Document Ingestion & Parsing**: Parses PDF (`pdfplumber`), DOCX (`python-docx`), and raw text files.
2. **Text Chunking & Prompting**: Chunks large inputs into ~1500 tokens with 200 token overlap to fit Ollama context boundaries.
3. **Semantic Clause Deduplication**: Compares and deduplicates extracted clauses locally using Hugging Face SentenceTransformers (all-MiniLM-L6-v2) and cosine similarity (threshold >= 0.85).
4. **Category Classification**: Automatically maps clauses to exactly one of six target categories (*Financial, Compliance, Operational, Legal, Documentation, Technical*) with reasoning and confidence levels.
5. **Real-time SSE Status Streaming**: Streams multi-stage pipeline logs, active charts, and cards to the frontend in real time using Server-Sent Events.
6. **Sequential Audit Engine**: Checks client specifications (either entered freeform or via a structured parameters panel) clause-by-clause.
7. **Score-based verdict cards**: Assigns points (PASS = 1.0, WARN = 0.5, FAIL = 0.0) and derives verdicts:
   - **Score >= 85**: Eligible (Green)
   - **Score 60 - 84**: Conditionally Eligible (Yellow)
   - **Score < 60**: Not Eligible (Red)
8. **Markdown Storage**: Saves extracted rules and compliance reports directly to the local filesystem as structured Markdown documents.

---

## Architecture Setup

### Prerequisites

1. **Install Ollama**: Download and install Ollama for your OS from [ollama.com](https://ollama.com).
2. **Pull the Required Models**: Open your terminal/command prompt and run:
   ```bash
   ollama pull llama3.2
   ollama pull bge-m3
   ```
3. **Start Ollama Service**: Run the background process:
   ```bash
   ollama serve
   ```
   *(Ensure it is running and accessible on `http://localhost:11434`)*

---

## Getting Started

### 1. Run Backend Server (FastAPI)

Navigate to the project root and perform the following:

- **Install Python Dependencies**:
  ```bash
  pip install -r backend/requirements.txt
  ```

- **Start Web Application Server**:
  ```bash
  uvicorn backend.main:app --reload --port 8000
  ```
  The API docs will be available at `http://localhost:8000/docs`.

### 2. Run Frontend Server (React + Vite)

Open a new terminal window, navigate to the `frontend/` directory, and run:

- **Install Node Packages**:
  ```bash
  cd frontend
  npm install
  ```

- **Start Development Server**:
  ```bash
  npm run dev
  ```

- **Open Browser View**:
  Access the client dashboard at **[http://localhost:5173](http://localhost:5173)**.

---

## Project Structure

```text
trade-compliance-system/
├── backend/
│   ├── main.py              # FastAPI app routing and SSE managers
│   ├── extractor.py         # Ingestion parsing, chunking, and fuzzy deduplication
│   ├── classifier.py        # Ollama classification logic
│   ├── validator.py         # Clause audit scoring and verdict mapping
│   ├── ollama_client.py     # HTTP wrapper client for llama3.2 API
│   ├── markdown_writer.py   # Markdown parser, writer, and reader
│   └── requirements.txt     # Python requirements
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── UploadZone.jsx        # Drag-and-drop input zone
│   │   │   ├── ProgressStepper.jsx   # Multi-stage extraction progress stepper
│   │   │   ├── ClauseCard.jsx        # Extracted clause display layout
│   │   │   ├── ValidationResult.jsx  # Individual audit card check display
│   │   │   └── VerdictBanner.jsx     # Header score banner showing result verdict
│   │   ├── pages/
│   │   │   ├── Extract.jsx   # Document parsing and stream page
│   │   │   ├── Validate.jsx  # Client requirement validation auditing page
│   │   │   └── History.jsx   # Historical markdown reports viewer and delete page
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   └── package.json
├── output/
│   ├── clauses/             # Saved extracted clause Markdown files
│   └── reports/             # Saved validation report Markdown files
└── README.md
```
