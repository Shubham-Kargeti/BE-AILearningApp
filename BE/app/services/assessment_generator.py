"""
Assessment question generation service.

This module integrates experience-based question generation logic with the
admin assessment creation workflow.
"""

from typing import Dict, List, Optional
from app.utils.experience_based_questions import (
    parse_experience_years,
    get_difficulty_distribution,
    get_passing_score_threshold,
    calculate_question_count_per_difficulty,
    get_adjusted_difficulty_distribution,
)
from app.db.models import Assessment, Candidate


async def get_assessment_config_for_candidate(
    assessment: Assessment,
    candidate: Optional[Candidate] = None
) -> Dict:
    """
    Get the final assessment configuration for a candidate.
    
    This takes into account:
    - Admin-configured assessment settings
    - Candidate's experience level (if auto_adjust_by_experience is True)
    - Generates the exact number of questions per difficulty level
    
    Args:
        assessment: The Assessment model instance
        candidate: Optional Candidate model instance with experience data
        
    Returns:
        Dictionary with:
        {
            "total_questions": 15,
            "question_type_mix": {"mcq": 0.5, "coding": 0.3, "architecture": 0.2},
            "difficulty_distribution": {"easy": 0.2, "medium": 0.5, "hard": 0.3},
            "passing_score_threshold": 70,
            "question_counts_per_difficulty": {"easy": 3, "medium": 8, "hard": 4},
            "experience_level": "mid-level",
            "adjusted_by_experience": True
        }
    """
    
    # Get candidate experience if available
    experience_years = 5  # Default
    experience_level = "mid-level"
    adjusted_by_experience = False
    
    if candidate and assessment.auto_adjust_by_experience:
        # Parse candidate's experience
        if candidate.experience_years:
            experience_years = parse_experience_years(candidate.experience_years)
        
        # Get adjusted difficulty distribution and threshold based on experience
        difficulty_distribution = get_difficulty_distribution(experience_years)
        passing_score_threshold = get_passing_score_threshold(experience_years)
        adjusted_by_experience = True
    else:
        # Use admin-configured values
        difficulty_distribution = assessment.difficulty_distribution or {
            "easy": 0.2,
            "medium": 0.5,
            "hard": 0.3
        }
        passing_score_threshold = assessment.passing_score_threshold or 70
    
    # Get experience level label
    from app.utils.experience_based_questions import get_experience_level_label
    experience_level = get_experience_level_label(experience_years)
    
    # Calculate question counts per difficulty
    question_counts = calculate_question_count_per_difficulty(
        assessment.total_questions,
        difficulty_distribution
    )
    
    return {
        "total_questions": assessment.total_questions,
        "question_type_mix": assessment.question_type_mix or {
            "mcq": 0.5,
            "coding": 0.3,
            "architecture": 0.2
        },
        "difficulty_distribution": difficulty_distribution,
        "passing_score_threshold": passing_score_threshold,
        "question_counts_per_difficulty": question_counts,
        "experience_level": experience_level,
        "experience_years": experience_years,
        "adjusted_by_experience": adjusted_by_experience,
        "auto_adjust_enabled": assessment.auto_adjust_by_experience,
    }


async def generate_questions_with_experience_config(
    assessment: Assessment,
    candidate: Optional[Candidate] = None,
    skills: Optional[List[str]] = None
) -> Dict:
    """
    Generate questions configuration that respects both admin settings and candidate experience.
    
    Args:
        assessment: The Assessment model
        candidate: Optional Candidate with experience data
        skills: List of skills to generate questions for
        
    Returns:
        Configuration dictionary ready for the LLM question generator
    """
    
    # Get the final assessment config
    config = await get_assessment_config_for_candidate(assessment, candidate)
    
    # Build the prompt configuration for the LLM
    skills_config = {}
    num_skills = len(skills) if skills else len(assessment.required_skills)
    
    if skills:
        # Use provided skills
        questions_per_skill = config["total_questions"] // num_skills
        remainder = config["total_questions"] % num_skills
        
        for i, skill in enumerate(skills):
            questions_for_skill = questions_per_skill + (1 if i < remainder else 0)
            skills_config[skill] = {
                "question_count": questions_for_skill,
                "difficulty_distribution": config["difficulty_distribution"]
            }
    else:
        # Use assessment's required_skills
        questions_per_skill = config["total_questions"] // num_skills
        remainder = config["total_questions"] % num_skills
        
        for i, (skill, proficiency) in enumerate(assessment.required_skills.items()):
            questions_for_skill = questions_per_skill + (1 if i < remainder else 0)
            skills_config[skill] = {
                "question_count": questions_for_skill,
                "difficulty_distribution": config["difficulty_distribution"],
                "required_proficiency": proficiency
            }
    
    return {
        **config,
        "skills_config": skills_config,
        "prompt_context": {
            "candidate_experience_level": config["experience_level"],
            "difficulty_instruction": format_difficulty_instruction(
                config["difficulty_distribution"],
                config["experience_level"]
            )
        }
    }


def format_difficulty_instruction(
    distribution: Dict[str, float],
    experience_level: str
) -> str:
    """
    Format difficulty distribution as a human-readable instruction for the LLM.
    
    Args:
        distribution: {"easy": 0.2, "medium": 0.5, "hard": 0.3}
        experience_level: "junior", "mid-level", "senior", "expert"
        
    Returns:
        Formatted instruction string
    """
    easy_pct = int(distribution.get("easy", 0) * 100)
    medium_pct = int(distribution.get("medium", 0) * 100)
    hard_pct = int(distribution.get("hard", 0) * 100)
    
    instructions = {
        "junior": f"Generate questions suitable for junior developers ({experience_level}). Distribution: {easy_pct}% easy, {medium_pct}% medium, {hard_pct}% hard. Focus on fundamentals and basic concepts.",
        "mid-level": f"Generate questions for mid-level developers ({experience_level}). Distribution: {easy_pct}% easy, {medium_pct}% medium, {hard_pct}% hard. Include practical scenarios and best practices.",
        "senior": f"Generate questions for senior developers ({experience_level}). Distribution: {easy_pct}% easy, {medium_pct}% medium, {hard_pct}% hard. Include architecture decisions and optimization.",
        "expert": f"Generate advanced questions for experts ({experience_level}). Distribution: {easy_pct}% easy, {medium_pct}% medium, {hard_pct}% hard. Include edge cases, performance, and system design."
    }
    
    return instructions.get(experience_level, "Generate appropriately challenging questions.")


# Example usage
if __name__ == "__main__":
    import asyncio
    from datetime import datetime
    
    # Mock Assessment
    class MockAssessment:
        def __init__(self):
            self.total_questions = 15
            self.question_type_mix = {"mcq": 0.5, "coding": 0.3, "architecture": 0.2}
            self.difficulty_distribution = {"easy": 0.2, "medium": 0.5, "hard": 0.3}
            self.passing_score_threshold = 70
            self.auto_adjust_by_experience = True
            self.required_skills = {"Python": "high", "System Design": "medium"}
    
    # Mock Candidate
    class MockCandidate:
        def __init__(self, experience_years_str):
            self.experience_years = experience_years_str
    
    async def test():
        assessment = MockAssessment()
        
        for exp_str in ["2 years", "5 years", "9 years", "15 years"]:
            candidate = MockCandidate(exp_str)
            config = await get_assessment_config_for_candidate(assessment, candidate)
            print(f"\nCandidate with {exp_str}:")
            print(f"  Experience level: {config['experience_level']}")
            print(f"  Difficulty: {config['difficulty_distribution']}")
            print(f"  Passing threshold: {config['passing_score_threshold']}%")
            print(f"  Questions per difficulty: {config['question_counts_per_difficulty']}")
    
    asyncio.run(test())
