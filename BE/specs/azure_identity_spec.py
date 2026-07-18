"""Focused security tests for Microsoft Entra ID token validation."""

from datetime import datetime, timedelta, timezone

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from jose import jwk, jwt

from app.services.azure_identity import (
    AzureIdTokenValidator,
    AzureTokenValidationError,
)


CLIENT_ID = "11111111-1111-1111-1111-111111111111"
TENANT_ID = "22222222-2222-2222-2222-222222222222"
KEY_ID = "test-signing-key"


def _create_signing_material() -> tuple[bytes, dict]:
    """Create an isolated RSA key pair that behaves like an Azure signing key."""

    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    public_pem = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    public_jwk = jwk.construct(public_pem, algorithm="RS256").to_dict()
    public_jwk.update({"kid": KEY_ID, "use": "sig", "alg": "RS256"})
    return private_pem, public_jwk


def _create_token(private_key: bytes, **claim_overrides: object) -> str:
    """Create a signed v2 ID token with optional invalid-claim overrides."""

    now = datetime.now(timezone.utc)
    claims = {
        "aud": CLIENT_ID,
        "iss": f"https://login.microsoftonline.com/{TENANT_ID}/v2.0",
        "iat": now,
        "nbf": now,
        "exp": now + timedelta(minutes=5),
        "sub": "pairwise-subject",
        "oid": "33333333-3333-3333-3333-333333333333",
        "tid": TENANT_ID,
        "ver": "2.0",
        "preferred_username": "employee@nagarro.com",
        "name": "Nagarro Employee",
    }
    claims.update(claim_overrides)
    return jwt.encode(
        claims,
        private_key,
        algorithm="RS256",
        headers={"kid": KEY_ID},
    )


def _validator_with_fake_azure(public_jwk: dict) -> AzureIdTokenValidator:
    """Return a validator whose metadata calls are deterministic and offline."""

    validator = AzureIdTokenValidator(client_id=CLIENT_ID, tenant_id=TENANT_ID)
    jwks_url = "https://login.microsoftonline.com/common/discovery/v2.0/keys"

    async def fake_fetch_json(url: str) -> dict:
        if url == validator.discovery_url:
            return {
                "issuer": validator.expected_issuer,
                "jwks_uri": jwks_url,
            }
        if url == jwks_url:
            return {"keys": [public_jwk]}
        raise AssertionError(f"Unexpected metadata URL: {url}")

    validator._fetch_json = fake_fetch_json  # type: ignore[method-assign]
    return validator


async def test_accepts_valid_azure_id_token() -> None:
    """A correctly signed token for this tenant/client returns trusted claims."""

    private_key, public_jwk = _create_signing_material()
    validator = _validator_with_fake_azure(public_jwk)

    claims = await validator.validate(_create_token(private_key))

    assert claims["preferred_username"] == "employee@nagarro.com"
    assert claims["tid"] == TENANT_ID


async def test_rejects_token_for_another_application() -> None:
    """A valid Azure signature is insufficient when the audience is different."""

    private_key, public_jwk = _create_signing_material()
    validator = _validator_with_fake_azure(public_jwk)
    token = _create_token(
        private_key,
        aud="99999999-9999-9999-9999-999999999999",
    )

    with pytest.raises(AzureTokenValidationError, match="invalid or expired"):
        await validator.validate(token)


async def test_rejects_token_claiming_another_tenant() -> None:
    """The tenant claim must match even when all standard JWT checks pass."""

    private_key, public_jwk = _create_signing_material()
    validator = _validator_with_fake_azure(public_jwk)
    token = _create_token(
        private_key,
        tid="99999999-9999-9999-9999-999999999999",
    )

    with pytest.raises(AzureTokenValidationError, match="invalid tenant"):
        await validator.validate(token)

