"""
Quick integration example for experience-based question generation.

This file demonstrates how to use the new experience-based question
generation system in your assessment API endpoints.
"""

# Example 1: Creating an Assessment with experience-based config
# ================================================================

from app.schemas import AssessmentCreate
from app.db.models import Assessment, Candidate
from app.services import get_assessment_config_for_candidate
import asyncio


async def example_create_assessment():
    """Example: Admin creates an assessment with experience-based config."""
    
    assessment_request = AssessmentCreate(
        title="Senior Python Developer Assessment",
        description="Assessment for senior Python development roles",
        job_title="Senior Python Developer",
        required_skills={
            "Python": "high",
            "FastAPI": "high",
            "System Design": "medium",
            "PostgreSQL": "medium"
        },
        duration_minutes=60,
        
        # NEW: Experience-based configuration
        total_questions=20,
        question_type_mix={
            "mcq": 0.4,          # 40% MCQ
            "coding": 0.4,       # 40% Coding problems
            "architecture": 0.2  # 20% Architecture/Design
        },
        passing_score_threshold=75,
        auto_adjust_by_experience=True,
        difficulty_distribution={
            "easy": 0.1,
            "medium": 0.4,
            "hard": 0.5
        }
    )
    
    # This would be saved to database
    # assessment = await create_assessment(assessment_request, session)
    
    print("✅ Assessment created with experience-based config")
    print(f"   Total questions: {assessment_request.total_questions}")
    print(f"   Passing score: {assessment_request.passing_score_threshold}%")
    print(f"   Auto-adjust: {assessment_request.auto_adjust_by_experience}")
    print(f"   Difficulty distribution: {assessment_request.difficulty_distribution}")


# Example 2: Getting assessment config for different candidates
# ==============================================================

async def example_get_config_for_candidates():
    """Example: Getting assessment config for candidates with different experience levels."""
    
    # Mock assessment and candidates
    class MockAssessment:
        def __init__(self):
            self.total_questions = 20
            self.question_type_mix = {"mcq": 0.4, "coding": 0.4, "architecture": 0.2}
            self.difficulty_distribution = {"easy": 0.1, "medium": 0.4, "hard": 0.5}
            self.passing_score_threshold = 75
            self.auto_adjust_by_experience = True
            self.required_skills = {"Python": "high", "FastAPI": "high", "System Design": "medium"}
    
    class MockCandidate:
        def __init__(self, name, experience_years):
            self.full_name = name
            self.experience_years = experience_years
            self.experience_level = "mid"
    
    assessment = MockAssessment()
    
    # Three candidates with different experience levels
    candidates = [
        MockCandidate("Alice", "2 years"),     # Junior
        MockCandidate("Bob", "5 years"),       # Mid-level
        MockCandidate("Charlie", "10 years"),  # Senior
    ]
    
    print("\n📊 Assessment Config for Different Candidates:")
    print("=" * 60)
    
    for candidate in candidates:
        config = await get_assessment_config_for_candidate(assessment, candidate)
        
        print(f"\n👤 {candidate.full_name} ({candidate.experience_years}):")
        print(f"   Experience Level: {config['experience_level']}")
        print(f"   Difficulty Distribution: {config['difficulty_distribution']}")
        print(f"   Passing Score: {config['passing_score_threshold']}%")
        print(f"   Questions per difficulty:")
        for diff, count in config['question_counts_per_difficulty'].items():
            print(f"     - {diff}: {count} questions")


# Example 3: Generating LLM-ready question prompt
# ================================================

async def example_generate_question_prompt():
    """Example: Generating prompt configuration ready for LLM."""
    
    from app.services import generate_questions_with_experience_config
    
    class MockAssessment:
        def __init__(self):
            self.total_questions = 15
            self.question_type_mix = {"mcq": 0.5, "coding": 0.3, "architecture": 0.2}
            self.difficulty_distribution = {"easy": 0.2, "medium": 0.5, "hard": 0.3}
            self.passing_score_threshold = 70
            self.auto_adjust_by_experience = True
            self.required_skills = {"Python": "high", "FastAPI": "medium"}
    
    class MockCandidate:
        def __init__(self):
            self.full_name = "John Doe"
            self.experience_years = "5 years"
    
    assessment = MockAssessment()
    candidate = MockCandidate()
    
    print("\n🔨 Generating Question Prompt Configuration:")
    print("=" * 60)
    
    config = await generate_questions_with_experience_config(
        assessment,
        candidate,
        skills=["Python", "FastAPI"]
    )
    
    print(f"\nExperience Level: {config['experience_level']}")
    print(f"Total Questions: {config['total_questions']}")
    print(f"Difficulty Distribution: {config['difficulty_distribution']}")
    print(f"Question Type Mix: {config['question_type_mix']}")
    print(f"\nSkills Configuration:")
    for skill, skill_config in config['skills_config'].items():
        print(f"  {skill}:")
        print(f"    - Questions: {skill_config['question_count']}")
        print(f"    - Difficulty: {skill_config['difficulty_distribution']}")
    
    print(f"\nPrompt Context:")
    print(f"  {config['prompt_context']['difficulty_instruction']}")


# Example 4: Experience parsing examples
# =======================================

def example_experience_parsing():
    """Example: Parsing various experience formats."""
    
    from app.utils.experience_based_questions import parse_experience_years, get_experience_level_label
    
    print("\n📝 Experience Parsing Examples:")
    print("=" * 60)
    
    test_cases = [
        "2 years",
        "5",
        "5-7 years",
        "7-11",
        "12+ years",
        "junior",
    ]
    
    for exp_str in test_cases:
        try:
            years = parse_experience_years(exp_str)
            label = get_experience_level_label(years)
            print(f"  '{exp_str}' → {years} years ({label})")
        except Exception as e:
            print(f"  '{exp_str}' → Error: {e}")


# Example 5: Question distribution calculation
# ============================================

def example_question_distribution():
    """Example: Calculating exact question counts per difficulty."""
    
    from app.utils.experience_based_questions import (
        get_difficulty_distribution,
        calculate_question_count_per_difficulty,
        get_passing_score_threshold,
    )
    
    print("\n📐 Question Distribution Examples:")
    print("=" * 60)
    
    experience_levels = [2, 5, 9, 15]
    
    for years in experience_levels:
        dist = get_difficulty_distribution(years)
        threshold = get_passing_score_threshold(years)
        counts = calculate_question_count_per_difficulty(20, dist)
        
        print(f"\n{years} years experience:")
        print(f"  Difficulty Distribution: {dist}")
        print(f"  Passing Threshold: {threshold}%")
        print(f"  Out of 20 questions: {counts}")


# Main execution
# ==============

async def main():
    """Run all examples."""
    
    print("\n" + "=" * 60)
    print("EXPERIENCE-BASED QUESTION GENERATION - INTEGRATION EXAMPLES")
    print("=" * 60)
    
    # Run examples
    await example_create_assessment()
    await example_get_config_for_candidates()
    await example_generate_question_prompt()
    example_experience_parsing()
    example_question_distribution()
    
    print("\n" + "=" * 60)
    print("✅ All examples completed successfully!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
