import os
import sys
import re
# Allow package resolution when executing uvicorn from backend/ directory
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import uuid
import shutil
import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

from fastapi import FastAPI, UploadFile, File, BackgroundTasks, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from backend.ollama_client import OllamaClient
from backend.extractor import (
    extract_text_from_file, 
    chunk_text, 
    extract_clauses_from_chunks, 
    deduplicate_clauses
)
from backend.classifier import classify_clause
from backend.validator import (
    validate_clause, 
    format_structured_requirements
)
from backend.scoring import (
    determine_verdict,
    calculate_compliance_score,
    evaluate_bidder
)
from backend.ranker import (
    rank_bidders,
    generate_leaderboard
)
from backend.markdown_writer import (
    OUTPUT_CLAUSES_DIR,
    OUTPUT_REPORTS_DIR,
    write_clauses_to_markdown,
    read_clauses_from_markdown,
    write_validation_report_to_markdown,
    read_validation_report_from_markdown
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Trade Compliance Document Processing System")

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ollama_client = OllamaClient()

# Global memory storage for active task queues
task_queues: Dict[str, asyncio.Queue] = {}
validation_queues: Dict[str, asyncio.Queue] = {}
ranking_queues: Dict[str, asyncio.Queue] = {}

# Ensure temporary upload directory exists
TEMP_UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "temp_uploads")
os.makedirs(TEMP_UPLOAD_DIR, exist_ok=True)

class ValidateRequest(BaseModel):
    clause_file: str
    client_requirements: Any  # Can be freeform string or structured dict

# ----------------- BACKGROUND EXTRACTION TASK -----------------
async def process_extraction_task(task_id: str, file_path: str, original_filename: str):
    queue = task_queues.get(task_id)
    if not queue:
        return
        
    try:
        # Step 1: Parsing
        await queue.put({"step": "parsing", "progress": 10, "message": "Parsing document text..."})
        # Wait a small delay to simulate processing steps if files are extremely small
        await asyncio.sleep(0.5)
        text = extract_text_from_file(file_path)
        if not text.strip():
            raise ValueError("No text could be extracted from the document.")
            
        # Step 2: Chunking
        await queue.put({"step": "chunking", "progress": 25, "message": "Chunking document text..."})
        await asyncio.sleep(0.5)
        chunks = chunk_text(text)
        await queue.put({
            "step": "chunking", 
            "progress": 30, 
            "message": f"Document split into {len(chunks)} chunks.", 
            "data": {"chunks_count": len(chunks)}
        })
        await asyncio.sleep(0.5)
        
        # Step 3: Extracting clauses
        extracted_clauses = []
        async def extraction_progress(chunk_idx, total_chunks, clauses_so_far):
            progress_pct = 30 + int((chunk_idx / total_chunks) * 35)  # 30% to 65%
            await queue.put({
                "step": "extracting",
                "progress": progress_pct,
                "message": f"Extracting clauses (chunk {chunk_idx} of {total_chunks})...",
                "data": {
                    "chunks_processed": chunk_idx,
                    "chunks_total": total_chunks,
                    "clauses_count": len(clauses_so_far)
                }
            })
            
        extracted_clauses = await extract_clauses_from_chunks(
            chunks, 
            ollama_client, 
            extraction_progress
        )
        
        if not extracted_clauses:
            await queue.put({"step": "saving", "progress": 90, "message": "No clauses extracted. Saving empty file..."})
            md_path = write_clauses_to_markdown(original_filename, [])
            await queue.put({
                "step": "completed", 
                "progress": 100, 
                "message": "Extraction complete. No clauses found.",
                "data": {"clauses": [], "markdown_path": md_path, "filename": os.path.basename(md_path)}
            })
            return
            
        # Deduplicate
        await queue.put({"step": "extracting", "progress": 68, "message": "Deduplicating extracted clauses..."})
        unique_clauses = await deduplicate_clauses(extracted_clauses, ollama_client)
        await queue.put({
            "step": "extracting", 
            "progress": 70, 
            "message": f"Deduplication complete. {len(unique_clauses)} unique clauses identified."
        })
        await asyncio.sleep(0.5)
        
        # Step 4: Classifying
        classified_clauses = []
        total_clauses = len(unique_clauses)
        for idx, clause in enumerate(unique_clauses, 1):
            progress_pct = 70 + int((idx / total_clauses) * 20)  # 70% to 90%
            await queue.put({
                "step": "classifying",
                "progress": progress_pct,
                "message": f"Classifying clause {idx} of {total_clauses}...",
                "data": {
                    "clauses_processed": idx,
                    "clauses_total": total_clauses,
                    "clause": clause
                }
            })
            
            classification = await classify_clause(clause["raw_text"], ollama_client)
            clause.update(classification)
            classified_clauses.append(clause)
            
            # Stream the newly classified clause to frontend in real-time
            await queue.put({
                "step": "classifying",
                "progress": progress_pct,
                "message": f"Classified clause {idx} of {total_clauses}",
                "data": {
                    "clauses_processed": idx,
                    "clauses_total": total_clauses,
                    "clause": clause,
                    "live_card": True
                }
            })
            
        # Step 5: Saving markdown
        await queue.put({"step": "saving", "progress": 95, "message": "Saving clauses to Markdown file..."})
        md_path = write_clauses_to_markdown(original_filename, classified_clauses)
        
        await queue.put({
            "step": "completed",
            "progress": 100,
            "message": "Extraction and classification completed successfully!",
            "data": {
                "clauses": classified_clauses,
                "markdown_path": md_path,
                "filename": os.path.basename(md_path)
            }
        })
        
    except Exception as e:
        logger.error(f"Error in extraction task {task_id}: {e}")
        await queue.put({
            "step": "failed",
            "progress": 100,
            "message": f"Extraction failed: {str(e)}"
        })
    finally:
        # Clean up temporary file
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as ex:
                logger.error(f"Could not remove temp file {file_path}: {ex}")

# ----------------- BACKGROUND VALIDATION TASK -----------------
async def process_validation_task(task_id: str, clause_filename: str, client_requirements: Any):
    queue = validation_queues.get(task_id)
    if not queue:
        return
        
    try:
        clause_file_path = os.path.join(OUTPUT_CLAUSES_DIR, clause_filename)
        if not os.path.exists(clause_file_path):
            raise FileNotFoundError(f"Clause file not found: {clause_filename}")
            
        await queue.put({"step": "loading", "progress": 10, "message": "Loading trade clauses..."})
        await asyncio.sleep(0.5)
        clauses = read_clauses_from_markdown(clause_file_path)
        
        if not clauses:
            raise ValueError("No clauses found in the selected file to validate against.")
            
        # Format client requirements
        if isinstance(client_requirements, dict):
            client_name = client_requirements.get("client_name", "Client")
            req_text = format_structured_requirements(client_requirements)
        else:
            client_name = "Client"
            req_text = str(client_requirements)
            
            # Simple heuristic to extract client name from plain text
            lines = req_text.splitlines()
            for line in lines:
                if ":" in line:
                    key, val = line.split(":", 1)
                    if "client" in key.lower() or "company" in key.lower():
                        client_name = val.strip()
                        break
                        
        await queue.put({
            "step": "validating", 
            "progress": 20, 
            "message": f"Validating requirements against {len(clauses)} clauses..."
        })
        await asyncio.sleep(0.5)
        
        results = []
        total_clauses = len(clauses)
        
        for idx, clause in enumerate(clauses, 1):
            progress_pct = 20 + int((idx / total_clauses) * 70)  # 20% to 90%
            
            await queue.put({
                "step": "validating",
                "progress": progress_pct,
                "message": f"Checking clause {idx} of {total_clauses}...",
                "data": {
                    "clauses_processed": idx,
                    "clauses_total": total_clauses
                }
            })
            
            val_res = await validate_clause(
                clause["clause_id"],
                clause["raw_text"],
                req_text,
                ollama_client
            )
            
            full_res = {
                "clause_id": clause["clause_id"],
                "category": clause.get("category", "Compliance"),
                "raw_text": clause["raw_text"],
                "status": val_res["status"],
                "reason": val_res["reason"],
                "missing": val_res["missing"]
            }
            results.append(full_res)
            
            # Stream validation result live
            await queue.put({
                "step": "validating",
                "progress": progress_pct,
                "message": f"Checked clause {idx} of {total_clauses}",
                "data": {
                    "clauses_processed": idx,
                    "clauses_total": total_clauses,
                    "result": full_res,
                    "live_result": True
                }
            })
            
        verdict_res = determine_verdict(results)
        compliance_score = calculate_compliance_score(results)
        summary = {
            "score": compliance_score,
            "verdict": verdict_res["verdict"],
            "passed": len([r for r in results if r["status"] == "PASS"]),
            "warnings": len([r for r in results if r["status"] == "WARN"]),
            "failed": len([r for r in results if r["status"] == "FAIL"]),
            "total": len(results)
        }
        
        await queue.put({"step": "saving", "progress": 95, "message": "Saving validation report..."})
        report_path = write_validation_report_to_markdown(
            client_name,
            clause_file_path,
            results,
            summary
        )
        
        await queue.put({
            "step": "completed",
            "progress": 100,
            "message": "Validation complete!",
            "data": {
                "results": results,
                "summary": summary,
                "report_path": report_path,
                "filename": os.path.basename(report_path)
            }
        })
        
    except Exception as e:
        logger.error(f"Error in validation task {task_id}: {e}")
        await queue.put({
            "step": "failed",
            "progress": 100,
            "message": f"Validation failed: {str(e)}"
        })

# ----------------- API ENDPOINTS -----------------

@app.get("/api/health")
async def check_health():
    """
    Check Ollama/Groq connectivity.
    """
    is_running = await ollama_client.check_health()
    if is_running:
        return {"status": "healthy", "ollama_running": True}
    elif os.environ.get("GROQ_API_KEY"):
        return {"status": "healthy", "groq_active": True}
    else:
        raise HTTPException(
            status_code=503, 
            detail="Ollama not running and GROQ_API_KEY is not set."
        )

@app.post("/api/extract")
async def extract_clauses(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    """
    Upload document, save it locally, generate a task_id and trigger async processing.
    """
    # Verify file extension
    filename = file.filename
    _, ext = os.path.splitext(filename.lower())
    if ext not in {".pdf", ".docx", ".txt"}:
        raise HTTPException(status_code=400, detail="Only PDF, DOCX, and TXT files are supported.")
        
    # Generate task ID
    task_id = str(uuid.uuid4())
    temp_file_path = os.path.join(TEMP_UPLOAD_DIR, f"{task_id}{ext}")
    
    # Save the file to temp folder
    try:
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
        
    # Initialize the asyncio Queue
    task_queues[task_id] = asyncio.Queue()
    
    # Start background execution
    background_tasks.add_task(process_extraction_task, task_id, temp_file_path, filename)
    
    return {
        "task_id": task_id,
        "filename": filename,
        "status": "queued"
    }

@app.get("/api/extract/stream")
async def extract_stream(task_id: str = Query(...)):
    """
    SSE stream of extraction progress.
    """
    if task_id not in task_queues:
        raise HTTPException(status_code=404, detail="Task queue not found or expired.")
        
    async def event_generator():
        queue = task_queues[task_id]
        while True:
            try:
                # Retrieve next progress report
                event_data = await queue.get()
                yield {"event": "progress", "data": json_dumps_utf8(event_data)}
                
                # Check for termination
                if event_data.get("step") in {"completed", "failed"}:
                    break
            except asyncio.CancelledError:
                logger.info(f"Stream client disconnected for task {task_id}")
                break
                
        # Clean up queue from memory
        if task_id in task_queues:
            del task_queues[task_id]
            
    return EventSourceResponse(event_generator())

@app.get("/api/clauses")
async def list_clauses():
    """
    List all saved clause markdown files.
    """
    files = []
    if not os.path.exists(OUTPUT_CLAUSES_DIR):
        return []
        
    for fname in os.listdir(OUTPUT_CLAUSES_DIR):
        if fname.endswith(".md"):
            fpath = os.path.join(OUTPUT_CLAUSES_DIR, fname)
            stat = os.stat(fpath)
            
            doc_name = fname
            count = 0
            try:
                with open(fpath, "r", encoding="utf-8") as f:
                    line1 = f.readline()
                    line2 = f.readline()
                    doc_match = re.search(r"# Trade Clauses — (.*)", line1)
                    if doc_match:
                        doc_name = doc_match.group(1).strip()
                    count_match = re.search(r"Total:\s*(\d+)", line2)
                    if count_match:
                        count = int(count_match.group(1))
            except Exception:
                pass
                
            files.append({
                "filename": fname,
                "doc_name": doc_name,
                "clause_count": count,
                "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                "size": stat.st_size
            })
            
    files.sort(key=lambda x: x["created_at"], reverse=True)
    return files

@app.get("/api/clauses/{filename}")
async def get_clause_file(filename: str):
    """
    Get specific clause file structured content and raw markdown.
    """
    fpath = os.path.join(OUTPUT_CLAUSES_DIR, filename)
    if not os.path.exists(fpath):
        raise HTTPException(status_code=404, detail="Clause file not found")
        
    try:
        clauses = read_clauses_from_markdown(fpath)
        with open(fpath, "r", encoding="utf-8") as f:
            raw_md = f.read()
            
        doc_name = filename
        doc_match = re.search(r"# Trade Clauses — (.*)", raw_md)
        if doc_match:
            doc_name = doc_match.group(1).strip()
            
        return {
            "filename": filename,
            "doc_name": doc_name,
            "clauses": clauses,
            "raw_markdown": raw_md
        }
    except Exception as e:
        logger.exception("Error reading clause file")
        raise HTTPException(status_code=500, detail=f"Error reading clause file: {str(e)}")

@app.delete("/api/clauses/{filename}")
async def delete_clause_file(filename: str):
    """
    Delete clause markdown file.
    """
    fpath = os.path.join(OUTPUT_CLAUSES_DIR, filename)
    if os.path.exists(fpath):
        os.remove(fpath)
        return {"status": "success", "message": f"Deleted clause file {filename}"}
    raise HTTPException(status_code=404, detail="Clause file not found")

@app.post("/api/validate")
async def validate_requirements(
    req: ValidateRequest,
    background_tasks: BackgroundTasks
):
    """
    Trigger validation of client requirements against a specific clause file.
    """
    task_id = str(uuid.uuid4())
    validation_queues[task_id] = asyncio.Queue()
    
    background_tasks.add_task(
        process_validation_task, 
        task_id, 
        req.clause_file, 
        req.client_requirements
    )
    
    return {
        "task_id": task_id,
        "status": "queued"
    }

@app.get("/api/validate/stream")
async def validate_stream(task_id: str = Query(...)):
    """
    SSE stream of validation progress.
    """
    if task_id not in validation_queues:
        raise HTTPException(status_code=404, detail="Validation task queue not found or expired.")
        
    async def event_generator():
        queue = validation_queues[task_id]
        while True:
            try:
                event_data = await queue.get()
                yield {"event": "progress", "data": json_dumps_utf8(event_data)}
                
                if event_data.get("step") in {"completed", "failed"}:
                    break
            except asyncio.CancelledError:
                logger.info(f"Stream client disconnected for validation task {task_id}")
                break
                
        if task_id in validation_queues:
            del validation_queues[task_id]
            
    return EventSourceResponse(event_generator())

@app.get("/api/reports")
async def list_reports():
    """
    List all saved validation reports.
    """
    files = []
    if not os.path.exists(OUTPUT_REPORTS_DIR):
        return []
        
    for fname in os.listdir(OUTPUT_REPORTS_DIR):
        if fname.endswith(".md"):
            fpath = os.path.join(OUTPUT_REPORTS_DIR, fname)
            stat = os.stat(fpath)
            
            client_name = fname
            score = 0.0
            verdict = "UNKNOWN"
            try:
                with open(fpath, "r", encoding="utf-8") as f:
                    content = f.read()
                    client_match = re.search(r"\*\*Client:\*\*\s*(.*)", content)
                    if client_match:
                        client_name = client_match.group(1).strip()
                    score_match = re.search(r"\*\*Score:\*\*\s*([\d\.]+)/100", content)
                    if score_match:
                        score = float(score_match.group(1).strip())
                    verdict_match = re.search(r"\*\*Verdict:\*\*\s*(.*)", content)
                    if verdict_match:
                        verdict = verdict_match.group(1).strip()
            except Exception:
                pass
                
            files.append({
                "filename": fname,
                "client_name": client_name,
                "score": score,
                "verdict": verdict,
                "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                "size": stat.st_size
            })
            
    files.sort(key=lambda x: x["created_at"], reverse=True)
    return files

@app.get("/api/reports/{filename}")
async def get_report_file(filename: str):
    """
    Get validation report structured data and raw markdown.
    """
    fpath = os.path.join(OUTPUT_REPORTS_DIR, filename)
    if not os.path.exists(fpath):
        raise HTTPException(status_code=404, detail="Report file not found")
        
    try:
        report_data = read_validation_report_from_markdown(fpath)
        with open(fpath, "r", encoding="utf-8") as f:
            raw_md = f.read()
        report_data["raw_markdown"] = raw_md
        report_data["filename"] = filename
        return report_data
    except Exception as e:
        logger.exception("Error reading report file")
        raise HTTPException(status_code=500, detail=f"Error reading report file: {str(e)}")

@app.delete("/api/reports/{filename}")
async def delete_report_file(filename: str):
    """
    Delete validation report file.
    """
    fpath = os.path.join(OUTPUT_REPORTS_DIR, filename)
    if os.path.exists(fpath):
        os.remove(fpath)
        return {"status": "success", "message": f"Deleted report file {filename}"}
    raise HTTPException(status_code=404, detail="Report file not found")

class BidderRequest(BaseModel):
    name: str
    bid_price: float
    requirements: Any

class RankBiddersRequest(BaseModel):
    clause_file: str
    bidders: List[BidderRequest]

# ----------------- BACKGROUND RANKING TASK -----------------
async def process_ranking_task(task_id: str, clause_filename: str, bidders: List[Dict[str, Any]]):
    queue = ranking_queues.get(task_id)
    if not queue:
        return
        
    try:
        clause_file_path = os.path.join(OUTPUT_CLAUSES_DIR, clause_filename)
        if not os.path.exists(clause_file_path):
            raise FileNotFoundError(f"Clause file not found: {clause_filename}")
            
        await queue.put({"step": "loading", "progress": 5, "message": "Loading rulebook..."})
        await asyncio.sleep(0.5)
        clauses = read_clauses_from_markdown(clause_file_path)
        
        if not clauses:
            raise ValueError("No clauses found in the selected rulebook.")
            
        evaluated_bidders = []
        total_bidders = len(bidders)
        
        for b_idx, bidder in enumerate(bidders, 1):
            bidder_name = bidder["name"]
            bid_price = bidder["bid_price"]
            reqs = bidder["requirements"]
            
            # Format requirements
            if isinstance(reqs, dict):
                req_text = format_structured_requirements(reqs)
            else:
                req_text = str(reqs)
                
            await queue.put({
                "step": "validating", 
                "progress": 5 + int(((b_idx - 1) / total_bidders) * 85), 
                "message": f"Evaluating '{bidder_name}' ({b_idx}/{total_bidders})..."
            })
            
            results = []
            total_clauses = len(clauses)
            for idx, clause in enumerate(clauses, 1):
                val_res = await validate_clause(
                    clause["clause_id"],
                    clause["raw_text"],
                    req_text,
                    ollama_client
                )
                
                results.append({
                    "clause_id": clause["clause_id"],
                    "category": clause.get("category", "Compliance"),
                    "raw_text": clause["raw_text"],
                    "clause_text": clause["raw_text"],  # Keep both key names for safety
                    "status": val_res["status"],
                    "reason": val_res["reason"],
                    "missing": val_res["missing"],
                    "mandatory": clause.get("mandatory", True)
                })
                
            eval_res = evaluate_bidder(results, bid_price)
            eval_res["name"] = bidder_name
            evaluated_bidders.append(eval_res)
            
        await queue.put({"step": "ranking", "progress": 92, "message": "Ranking bidders and generating leaderboard..."})
        await asyncio.sleep(0.5)
        
        ranking_results = rank_bidders(evaluated_bidders)
        leaderboard_md = generate_leaderboard(ranking_results)
        
        # Save leaderboard markdown
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_filename = f"Leaderboard_{timestamp}.md"
        report_path = os.path.join(OUTPUT_REPORTS_DIR, report_filename)
        with open(report_path, "w", encoding="utf-8") as f:
            f.write(leaderboard_md)
            
        await queue.put({
            "step": "completed",
            "progress": 100,
            "message": "Ranking complete!",
            "data": {
                "ranking": ranking_results,
                "report_path": report_path,
                "filename": report_filename,
                "raw_markdown": leaderboard_md
            }
        })
        
    except Exception as e:
        logger.exception(f"Error in ranking task {task_id}")
        await queue.put({
            "step": "failed",
            "progress": 100,
            "message": f"Ranking failed: {str(e)}"
        })

@app.post("/api/rank")
async def rank_multiple_bidders(
    req: RankBiddersRequest,
    background_tasks: BackgroundTasks
):
    """
    Trigger evaluation and ranking of multiple bidders.
    """
    task_id = str(uuid.uuid4())
    ranking_queues[task_id] = asyncio.Queue()
    
    # Convert Pydantic objects to dicts
    bidders_data = []
    for b in req.bidders:
        bidders_data.append({
            "name": b.name,
            "bid_price": b.bid_price,
            "requirements": b.requirements
        })
        
    background_tasks.add_task(
        process_ranking_task,
        task_id,
        req.clause_file,
        bidders_data
    )
    
    return {
        "task_id": task_id,
        "status": "queued"
    }

@app.get("/api/rank/stream")
async def rank_stream(task_id: str = Query(...)):
    """
    SSE stream of ranking progress.
    """
    if task_id not in ranking_queues:
        raise HTTPException(status_code=404, detail="Ranking task queue not found or expired.")
        
    async def event_generator():
        queue = ranking_queues[task_id]
        while True:
            try:
                event_data = await queue.get()
                yield {"event": "progress", "data": json_dumps_utf8(event_data)}
                
                if event_data.get("step") in {"completed", "failed"}:
                    break
            except asyncio.CancelledError:
                logger.info(f"Stream client disconnected for ranking task {task_id}")
                break
                
        if task_id in ranking_queues:
            del ranking_queues[task_id]
            
    return EventSourceResponse(event_generator())

# Helper utility to dump JSON safely as UTF-8 string
def json_dumps_utf8(data: Any) -> str:
    import json
    return json.dumps(data, ensure_ascii=False)
