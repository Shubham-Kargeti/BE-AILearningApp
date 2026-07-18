"""Validate Microsoft Entra ID tokens received from the MSAL frontend."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from time import monotonic
from typing import Any

import httpx
from jose import JWTError, jwt


class AzureIdentityConfigurationError(RuntimeError):
    """Raised when required Azure server configuration is missing or invalid."""


class AzureTokenValidationError(ValueError):
    """Raised when a supplied Azure ID token cannot be trusted."""


@dataclass
class _CachedDocument:
    """Small in-memory cache entry for Azure discovery and signing-key documents."""

    value: dict[str, Any]
    expires_at: float


class AzureIdTokenValidator:
    """Validate v2 Microsoft Entra ID tokens for one tenant and SPA client."""

    def __init__(
        self,
        *,
        client_id: str,
        tenant_id: str,
        cache_ttl_seconds: int = 3600,
        http_timeout_seconds: float = 5.0,
    ) -> None:
        self.client_id = client_id.strip()
        self.tenant_id = tenant_id.strip()
        self.cache_ttl_seconds = cache_ttl_seconds
        self.http_timeout_seconds = http_timeout_seconds
        self._cache: dict[str, _CachedDocument] = {}
        self._cache_lock = asyncio.Lock()

    @property
    def expected_issuer(self) -> str:
        """Issuer used by v2 tokens from the configured workforce tenant."""

        return f"https://login.microsoftonline.com/{self.tenant_id}/v2.0"

    @property
    def discovery_url(self) -> str:
        """Tenant-specific OpenID Connect metadata endpoint."""

        return (
            f"https://login.microsoftonline.com/{self.tenant_id}"
            "/v2.0/.well-known/openid-configuration"
        )

    def _ensure_configured(self) -> None:
        missing = [
            name
            for name, value in (
                ("AZURE_CLIENT_ID", self.client_id),
                ("AZURE_TENANT_ID", self.tenant_id),
            )
            if not value
        ]
        if missing:
            raise AzureIdentityConfigurationError(
                f"Missing Azure configuration: {', '.join(missing)}"
            )

    async def _fetch_json(self, url: str) -> dict[str, Any]:
        """Fetch a trusted Azure metadata document with a bounded timeout."""

        try:
            async with httpx.AsyncClient(
                timeout=self.http_timeout_seconds,
                follow_redirects=False,
            ) as client:
                response = await client.get(url)
                response.raise_for_status()
                payload = response.json()
        except (httpx.HTTPError, ValueError) as error:
            raise AzureIdentityConfigurationError(
                "Microsoft identity metadata is temporarily unavailable"
            ) from error

        if not isinstance(payload, dict):
            raise AzureIdentityConfigurationError(
                "Microsoft identity metadata returned an invalid document"
            )
        return payload

    async def _get_document(
        self,
        url: str,
        *,
        force_refresh: bool = False,
    ) -> dict[str, Any]:
        """Read a metadata document from memory or refresh it from Microsoft."""

        now = monotonic()
        cached = self._cache.get(url)
        if not force_refresh and cached and cached.expires_at > now:
            return cached.value

        async with self._cache_lock:
            now = monotonic()
            cached = self._cache.get(url)
            if not force_refresh and cached and cached.expires_at > now:
                return cached.value

            value = await self._fetch_json(url)
            self._cache[url] = _CachedDocument(
                value=value,
                expires_at=now + self.cache_ttl_seconds,
            )
            return value

    @staticmethod
    def _find_signing_key(jwks: dict[str, Any], key_id: str) -> dict[str, Any] | None:
        """Find the public signing key matching the JWT header's key ID."""

        keys = jwks.get("keys", [])
        if not isinstance(keys, list):
            return None
        return next(
            (
                key
                for key in keys
                if isinstance(key, dict) and key.get("kid") == key_id
            ),
            None,
        )

    async def validate(self, id_token: str) -> dict[str, Any]:
        """Verify signature, issuer, audience, lifetime, tenant, and identity claims."""

        self._ensure_configured()
        if not id_token or len(id_token) > 20_000:
            raise AzureTokenValidationError("Azure ID token is missing or malformed")

        try:
            header = jwt.get_unverified_header(id_token)
        except JWTError as error:
            raise AzureTokenValidationError("Azure ID token is malformed") from error

        if header.get("alg") != "RS256" or not header.get("kid"):
            raise AzureTokenValidationError("Azure ID token uses an unsupported signature")

        metadata = await self._get_document(self.discovery_url)
        if metadata.get("issuer") != self.expected_issuer:
            raise AzureIdentityConfigurationError(
                "Microsoft identity metadata returned an unexpected issuer"
            )

        jwks_uri = metadata.get("jwks_uri")
        if not isinstance(jwks_uri, str) or not jwks_uri.startswith(
            "https://login.microsoftonline.com/"
        ):
            raise AzureIdentityConfigurationError(
                "Microsoft identity metadata returned an invalid signing-key URL"
            )

        jwks = await self._get_document(jwks_uri)
        signing_key = self._find_signing_key(jwks, header["kid"])

        # Azure rotates signing keys. Refresh once when a token references a new key.
        if signing_key is None:
            jwks = await self._get_document(jwks_uri, force_refresh=True)
            signing_key = self._find_signing_key(jwks, header["kid"])

        if signing_key is None:
            raise AzureTokenValidationError("Azure ID token signing key was not found")

        try:
            claims = jwt.decode(
                id_token,
                signing_key,
                algorithms=["RS256"],
                audience=self.client_id,
                issuer=self.expected_issuer,
                options={
                    "require_aud": True,
                    "require_exp": True,
                    "require_iat": True,
                    "require_iss": True,
                    "require_sub": True,
                },
            )
        except JWTError as error:
            raise AzureTokenValidationError(
                "Azure ID token is invalid or expired"
            ) from error

        if claims.get("tid") != self.tenant_id or claims.get("ver") != "2.0":
            raise AzureTokenValidationError("Azure ID token is from an invalid tenant")

        if not claims.get("oid"):
            raise AzureTokenValidationError("Azure ID token has no object identifier")

        return claims

