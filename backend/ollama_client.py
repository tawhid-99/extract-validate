import json
import logging
import re
import os
import httpx
from fastapi import HTTPException

logger = logging.getLogger(__name__)

def load_env_file():
    # Try to load .env from current dir or project root
    paths = [
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"),
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env.local"),
        ".env",
        "../.env"
    ]
    for path in paths:
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            k, v = line.split("=", 1)
                            os.environ[k.strip()] = v.strip().strip("'\"")
            except Exception:
                pass

load_env_file()

OLLAMA_BASE_URL = "http://localhost:11434"
OLLAMA_MODEL = "llama3.2"
OLLAMA_EMBED_MODEL = "bge-m3"

class OllamaClient:
    def __init__(self, base_url: str = OLLAMA_BASE_URL, model: str = OLLAMA_MODEL, embed_model: str = OLLAMA_EMBED_MODEL):
        self.base_url = base_url
        self.model = model
        self.embed_model = embed_model
        self.generate_url = f"{base_url}/api/generate"

    async def check_health(self) -> bool:
        """
        Check if Ollama or Groq is running and responsive.
        """
        if os.environ.get("GROQ_API_KEY"):
            try:
                async with httpx.AsyncClient(timeout=3.0) as client:
                    # Check connection to Groq API
                    response = await client.get("https://api.groq.com/openai/v1/models", headers={
                        "Authorization": f"Bearer {os.environ.get('GROQ_API_KEY')}"
                    })
                    return response.status_code in {200, 401} # 200 is healthy, 401 is invalid key but reachable
            except Exception:
                return False

        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                response = await client.get(self.base_url)
                return response.status_code == 200
        except Exception:
            return False

    def clean_json_response(self, raw_text: str) -> str:
        """
        Extract JSON content from LLM markdown wrappers and code blocks.
        """
        text = raw_text.strip()
        
        # Match ```json ... ``` or ``` ... ```
        pattern = r"```(?:json)?\s*(.*?)\s*```"
        match = re.search(pattern, text, re.DOTALL)
        if match:
            text = match.group(1).strip()
            
        # If still not parsing, try to extract from first [ or { to last ] or }
        if not (text.startswith("{") or text.startswith("[")):
            start_bracket = re.search(r"[\{\[]", text)
            if start_bracket:
                start_idx = start_bracket.start()
                # Find matching or last bracket
                end_char = "}" if text[start_idx] == "{" else "]"
                end_idx = text.rfind(end_char)
                if end_idx != -1:
                    text = text[start_idx:end_idx + 1]
        
        return text

    async def call_ollama_raw(self, prompt: str, temperature: float = 0.1, response_format: str = None) -> str:
        """
        Make a raw request to Ollama.
        Tries with 30s timeout first, then retries with 180s in case model was loading.
        """
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": temperature,
                "top_p": 0.9,
                "num_ctx": 4096
            }
        }
        if response_format:
            payload["format"] = response_format
            
        timeouts = [120.0, 180.0]
        for attempt, timeout_val in enumerate(timeouts, 1):
            try:
                async with httpx.AsyncClient(timeout=timeout_val) as client:
                    response = await client.post(self.generate_url, json=payload)
                    if response.status_code != 200:
                        raise HTTPException(
                            status_code=502, 
                            detail=f"Ollama server returned error: {response.text}"
                        )
                    res_data = response.json()
                    return res_data.get("response", "")
            except httpx.ConnectError:
                raise HTTPException(
                    status_code=503, 
                    detail="Ollama not running. Start with: ollama serve"
                )
            except httpx.TimeoutException:
                if attempt < len(timeouts):
                    logger.warning(f"Ollama request timed out after {timeout_val}s. Retrying with a {timeouts[attempt]}s limit in case model was loading...")
                    continue
                raise HTTPException(
                    status_code=504, 
                    detail=f"Request to Ollama timed out (limit of {timeout_val} seconds reached)."
                )
            except Exception as e:
                if isinstance(e, HTTPException):
                    raise e
                raise HTTPException(
                    status_code=500, 
                    detail=f"Error communicating with Ollama: {str(e)}"
                )

    async def generate_json(self, system_prompt: str, user_message: str, temperature: float = 0.1) -> any:
        """
        Call Groq API (if GROQ_API_KEY is set) or Ollama (fallback) and ensure response is parsed as JSON.
        """
        groq_key = os.environ.get("GROQ_API_KEY")
        if groq_key:
            model = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
            headers = {
                "Authorization": f"Bearer {groq_key}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message}
                ],
                "temperature": temperature,
                "response_format": {"type": "json_object"}
            }
            
            logger.info(f"Using Groq API ({model}) for generation...")
            for attempt in range(2):
                try:
                    async with httpx.AsyncClient(timeout=60.0) as client:
                        response = await client.post(
                            "https://api.groq.com/openai/v1/chat/completions",
                            json=payload,
                            headers=headers
                        )
                        if response.status_code != 200:
                            raise HTTPException(
                                status_code=502,
                                detail=f"Groq API returned error: {response.text}"
                            )
                        res_data = response.json()
                        content = res_data["choices"][0]["message"]["content"]
                        cleaned = self.clean_json_response(content)
                        parsed = json.loads(cleaned)
                        return parsed
                except (json.JSONDecodeError, ValueError) as e:
                    logger.warning(f"Groq JSON decode failed on attempt {attempt + 1}. Error: {e}")
                    if attempt == 1:
                        raise HTTPException(
                            status_code=500,
                            detail="Failed to parse valid JSON from Groq response."
                        )
                except Exception as e:
                    if isinstance(e, HTTPException):
                        raise e
                    logger.error(f"Error calling Groq API: {e}")
                    if attempt == 1:
                        raise HTTPException(
                            status_code=500,
                            detail=f"Error communicating with Groq: {str(e)}"
                        )

        # Fallback to Ollama
        full_prompt = f"{system_prompt}\n\nUSER: {user_message}"
        
        for attempt in range(2):
            try:
                raw_response = await self.call_ollama_raw(full_prompt, temperature, response_format="json")
                cleaned = self.clean_json_response(raw_response)
                parsed = json.loads(cleaned)
                return parsed
            except (json.JSONDecodeError, ValueError) as e:
                logger.warning(f"JSON decode failed on attempt {attempt + 1}. Raw text: {raw_response}. Error: {e}")
                if attempt == 1:
                    raise HTTPException(
                        status_code=500,
                        detail="Failed to parse valid JSON from Ollama response after 2 attempts."
                    )
            except HTTPException as e:
                raise e

    async def get_embedding(self, prompt: str) -> list:
        """
        Get vector embedding for a text from Ollama.
        Tries with 30s timeout first, then retries with 180s.
        """
        payload = {
            "model": self.embed_model,
            "prompt": prompt
        }
        
        timeouts = [60.0, 180.0]
        for attempt, timeout_val in enumerate(timeouts, 1):
            try:
                async with httpx.AsyncClient(timeout=timeout_val) as client:
                    response = await client.post(f"{self.base_url}/api/embeddings", json=payload)
                    if response.status_code == 200:
                        return response.json().get("embedding", [])
                    else:
                        logger.error(f"Ollama embeddings endpoint returned status {response.status_code}: {response.text}")
            except httpx.TimeoutException:
                if attempt < len(timeouts):
                    logger.warning(f"Ollama embeddings request timed out after {timeout_val}s. Retrying with a {timeouts[attempt]}s limit...")
                    continue
                logger.error(f"Ollama embeddings timed out after {timeout_val}s limit.")
            except Exception as e:
                logger.error(f"Error calling Ollama embeddings: {e}")
        return []
