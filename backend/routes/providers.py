# backend/routes/providers.py

from fastapi import APIRouter

from schemas.chat_response import ProvidersInfoResponse, ProvidersResponse
from services.provider_service import ProviderService

router = APIRouter(tags=["providers"])


@router.get("/providers", response_model=ProvidersResponse)
def get_providers():
    return ProvidersResponse(providers=ProviderService.get_all_providers())


@router.get("/providers/info", response_model=ProvidersInfoResponse)
def get_provider_info():
    return ProvidersInfoResponse(providers=ProviderService.get_all_provider_info())
