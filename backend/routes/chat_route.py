# backend/routes/chat_route.py

import json

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from schemas.chat_schema import ChatRequest

from services.provider_service import (
    ProviderService
)

from services.orchestrator_service import (
    OrchestratorService
)

from memory.chat_buffer import ChatBuffer

router = APIRouter()

chat_buffer = ChatBuffer()


@router.post("/chat")
async def chat(request: ChatRequest):

    try:

        provider_names = request.providers

        if not provider_names:

            provider_names = [
                request.provider
            ]

        orchestration_result = (
            await OrchestratorService.process_chat(
                message=request.message,
                provider_names=provider_names,
                compare_mode=request.compare_mode,
                selector_enabled=request.selector_enabled
            )
        )

        best_response = (
            orchestration_result["best_response"]
        )

        selected_model = (
            orchestration_result["selected_model"]
        )

        selected_model_data = (
            orchestration_result[
                "selected_model_data"
            ]
        )

        all_responses = (
            orchestration_result["all_responses"]
        )

        failed_providers = (
            orchestration_result[
                "failed_providers"
            ]
        )

        execution_metadata = (
            orchestration_result[
                "execution_metadata"
            ]
        )

        compare_mode = (
            orchestration_result[
                "compare_mode"
            ]
        )

        selector_enabled = (
            orchestration_result[
                "selector_enabled"
            ]
        )

        selector_scores = (
            orchestration_result[
                "selector_scores"
            ]
        )

        selector_reason = (
            orchestration_result[
                "selector_reason"
            ]
        )

        compare_summary = (
            orchestration_result[
                "compare_summary"
            ]
        )

        comparison_count = (
            orchestration_result.get(
                "comparison_count",
                0
            )
        )

        chat_buffer.add_message(

            user_message=request.message,

            best_response=best_response,

            selected_model=selected_model,

            all_responses=all_responses,

            failed_providers=failed_providers,

            selector_used=selector_enabled
        )

        return {

            "response": best_response,

            "selected_model": selected_model,

            "selected_model_data": (
                selected_model_data
            ),

            "all_responses": all_responses,

            "failed_providers": (
                failed_providers
            ),

            "execution_metadata": (
                execution_metadata
            ),

            "compare_mode": compare_mode,

            "selector_enabled": (
                selector_enabled
            ),

            "selector_scores": (
                selector_scores
            ),

            "selector_reason": (
                selector_reason
            ),

            "compare_summary": (
                compare_summary
            ),

            "comparison_count": (
                comparison_count
            ),
        }

    except Exception as error:

        return {
            "error": str(error)
        }


@router.post("/chat/stream")
async def chat_stream(request: ChatRequest):

    async def generate():

        full_response = ""

        try:

            async for event in ProviderService.generate_stream(

                message=request.message,

                provider_name=request.provider
            ):

                content = event["content"]

                full_response += content

                yield json.dumps(event) + "\n"

            chat_buffer.add_message(

                user_message=request.message,

                best_response=full_response,

                selected_model=request.provider,

                all_responses={
                    request.provider: {
                        "response": full_response,
                        "model": event["model"],
                    }
                },

                failed_providers=[],

                selector_used=False
            )

        except Exception as error:

            error_event = {
                "type": "error",
                "content": str(error)
            }

            yield json.dumps(error_event) + "\n"

    return StreamingResponse(

        generate(),

        media_type="application/json"
    )


@router.post("/chat/structured")
async def structured_chat(request: ChatRequest):

    try:

        response = await ProviderService.generate_structured(

            message=request.message,

            provider_name=request.provider
        )

        return {
            "structured_response": response
        }

    except Exception as error:

        return {
            "error": str(error)
        }


@router.get("/providers")
def get_providers():

    return {
        "providers": ProviderService.get_all_providers()
    }


@router.get("/providers/info")
def get_provider_info():

    return {
        "providers": (
            ProviderService.get_all_provider_info()
        )
    }


@router.get("/memory")
def get_memory():

    return {
        "memory": chat_buffer.get_messages()
    }


@router.get("/memory/json")
def memory_json():

    return chat_buffer.to_json()


@router.delete("/memory")
def clear_memory():

    chat_buffer.clear()

    return {
        "message": "Memory cleared"
    }