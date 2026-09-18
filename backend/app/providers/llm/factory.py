from app.core.config import Settings
from app.providers.llm.dev import DevLLMProvider
from app.providers.llm.openai_compatible import OpenAICompatibleProvider


def get_llm_provider(settings: Settings):
    if (
        settings.llm_provider_resolved in {"openai", "openai_compatible"}
        and settings.openai_api_key
    ):
        return OpenAICompatibleProvider(
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url,
            model=settings.openai_model,
            timeout_seconds=settings.llm_timeout_seconds,
        )
    return DevLLMProvider()
