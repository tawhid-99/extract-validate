import os
import sys
import unittest
from unittest.mock import AsyncMock, patch

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.ollama_client import OllamaClient


class EnvModelSelectionTest(unittest.TestCase):
    def test_client_prefers_env_model(self):
        os.environ["LLM_Model"] = "llama-3.3-70b-versatile"
        os.environ.pop("GROQ_MODEL", None)

        client = OllamaClient()

        self.assertEqual(client.model, "llama-3.3-70b-versatile")

    async def _async_test_get_embedding_returns_empty_on_404(self):
        client = OllamaClient()

        class FakeResponse:
            status_code = 404
            text = '{"error":"model not found"}'

        fake_client = AsyncMock()
        fake_client.__aenter__ = AsyncMock(return_value=fake_client)
        fake_client.__aexit__ = AsyncMock(return_value=None)
        fake_client.post = AsyncMock(return_value=FakeResponse())

        with patch("backend.ollama_client.httpx.AsyncClient", return_value=fake_client):
            result = await client.get_embedding("hello")

        self.assertEqual(result, [])

    def test_get_embedding_returns_empty_on_404(self):
        import asyncio

        asyncio.run(self._async_test_get_embedding_returns_empty_on_404())


if __name__ == "__main__":
    unittest.main()
