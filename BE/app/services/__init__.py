"""
Services package for business logic.

This package contains service modules that handle application business logic,
including assessment generation, question distribution, and scoring.
"""

__all__ = [
    "get_assessment_config_for_candidate",
    "generate_questions_with_experience_config",
    "format_difficulty_instruction",
]


def __getattr__(name):
    if name in __all__:
        from importlib import import_module

        assessment_generator = import_module("app.services.assessment_generator")
        return getattr(assessment_generator, name)
    raise AttributeError(f"module 'app.services' has no attribute {name!r}")
