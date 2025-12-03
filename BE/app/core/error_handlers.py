"""Global error handling and validation error responses."""
from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from datetime import datetime
from typing import List, Dict, Any

from app.models.schemas import FieldError, ValidationErrorResponse


async def validation_error_handler(request: Request, exc: RequestValidationError):
    """
    Custom validation error handler for FastAPI.
    
    Converts Pydantic validation errors into a standardized format for frontend.
    
    Returns:
    {
        "success": false,
        "error_type": "VALIDATION_ERROR",
        "message": "Validation failed for the request",
        "field_errors": [
            {
                "field": "email",
                "error_code": "INVALID_EMAIL",
                "message": "Invalid email format",
                "value": "not-an-email"
            },
            ...
        ],
        "timestamp": "2025-12-03T10:30:00"
    }
    """
    field_errors: List[FieldError] = []
    
    for error in exc.errors():
        loc = error.get("loc", ())
        field_name = str(loc[-1]) if loc else "unknown"
        error_type = error.get("type", "unknown")
        msg = error.get("msg", "Validation error")
        
        # Map Pydantic error types to custom error codes
        error_code = map_pydantic_error_to_code(error_type, msg)
        
        field_errors.append(
            FieldError(
                field=field_name,
                error_code=error_code,
                message=format_error_message(error_type, msg),
                value=str(error.get("input", None))
            )
        )
    
    response = ValidationErrorResponse(
        success=False,
        error_type="VALIDATION_ERROR",
        message=f"Validation failed: {len(field_errors)} field(s) have errors",
        field_errors=field_errors,
        timestamp=datetime.utcnow()
    )
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=response.model_dump()
    )


def map_pydantic_error_to_code(error_type: str, msg: str) -> str:
    """Map Pydantic error types to custom error codes."""
    error_mapping = {
        "value_error.email": "INVALID_EMAIL",
        "type_error.email": "INVALID_EMAIL",
        "value_error.number.not_at_least": "VALUE_TOO_SMALL",
        "value_error.number.not_at_most": "VALUE_TOO_LARGE",
        "type_error.string": "INVALID_STRING",
        "type_error.integer": "INVALID_INTEGER",
        "type_error.integer.parsing": "INVALID_INTEGER",
        "value_error.missing": "MISSING_FIELD",
        "type_error.none.not_allowed": "FIELD_REQUIRED",
        "value_error.list.unique_items": "DUPLICATE_VALUES",
        "string_too_short": "STRING_TOO_SHORT",
        "string_too_long": "STRING_TOO_LONG",
        "string_pattern_mismatch": "INVALID_FORMAT",
    }
    
    # Check direct mapping first
    if error_type in error_mapping:
        return error_mapping[error_type]
    
    # Check partial matches
    for key, code in error_mapping.items():
        if key in error_type:
            return code
    
    # Check message-based mappings
    if "at least" in msg.lower():
        return "VALUE_TOO_SMALL"
    if "at most" in msg.lower():
        return "VALUE_TOO_LARGE"
    if "not allowed" in msg.lower():
        return "FIELD_REQUIRED"
    
    # Default
    return "VALIDATION_ERROR"


def format_error_message(error_type: str, msg: str) -> str:
    """Format error message for frontend display."""
    # Clean up Pydantic's verbose messages
    if "ensure this value has at least" in msg:
        match = msg.split("ensure this value has at least")
        if len(match) > 1:
            return f"Minimum length: {match[1].strip()}"
    
    if "ensure this value has at most" in msg:
        match = msg.split("ensure this value has at most")
        if len(match) > 1:
            return f"Maximum length: {match[1].strip()}"
    
    if "value is not a valid email address" in msg:
        return "Please enter a valid email address"
    
    return msg


# ============ STANDARD ERROR CODES ============

ERROR_CODES = {
    # Validation Errors (400-level)
    "INVALID_EMAIL": ("Invalid email format", 422),
    "MISSING_FIELD": ("Required field is missing", 422),
    "FIELD_REQUIRED": ("This field is required", 422),
    "VALUE_TOO_SMALL": ("Value is too small", 422),
    "VALUE_TOO_LARGE": ("Value is too large", 422),
    "STRING_TOO_SHORT": ("String is too short", 422),
    "STRING_TOO_LONG": ("String is too long", 422),
    "INVALID_INTEGER": ("Must be an integer", 422),
    "INVALID_FORMAT": ("Invalid format", 422),
    "DUPLICATE_VALUES": ("Duplicate values not allowed", 422),
    
    # Resource Errors (404)
    "NOT_FOUND": ("Resource not found", 404),
    "CANDIDATE_NOT_FOUND": ("Candidate not found", 404),
    "ASSESSMENT_NOT_FOUND": ("Assessment not found", 404),
    "FILE_NOT_FOUND": ("File not found", 404),
    
    # Conflict Errors (409)
    "DUPLICATE_EMAIL": ("Email already registered", 409),
    "DUPLICATE_ENTRY": ("This entry already exists", 409),
    "ALREADY_APPLIED": ("You have already applied for this assessment", 409),
    
    # Auth Errors (401/403)
    "UNAUTHORIZED": ("Authentication required", 401),
    "FORBIDDEN": ("You don't have permission to access this resource", 403),
    "ADMIN_ONLY": ("Admin access required", 403),
    
    # Server Errors (500)
    "INTERNAL_ERROR": ("An internal error occurred", 500),
    "FILE_UPLOAD_ERROR": ("Failed to upload file", 500),
    "EXTRACTION_ERROR": ("Failed to extract content from file", 500),
}


def get_error_response(error_code: str, message: str = None) -> tuple:
    """
    Get standardized error response.
    
    Returns: (message, status_code)
    """
    if error_code in ERROR_CODES:
        default_msg, status_code = ERROR_CODES[error_code]
        return message or default_msg, status_code
    
    return "An error occurred", 500
