"""
Experience-based question generation logic.

This module provides utilities to adjust question difficulty distribution based on
candidate experience level, ensuring candidates are challenged appropriately.
"""

from typing import Dict, List, Tuple
from dataclasses import dataclass


@dataclass
class ExperienceConfig:
    """Configuration for experience-based question generation."""
    min_years: int
    max_years: int
    difficulty_distribution: Dict[str, float]  # {"easy": 0.2, "medium": 0.5, "hard": 0.3}
    passing_score_threshold: int  # 0-100 percentage


# Experience bands with corresponding difficulty distributions
EXPERIENCE_BANDS = [
    ExperienceConfig(
        min_years=0,
        max_years=3,
        difficulty_distribution={"easy": 1.0, "medium": 0.0, "hard": 0.0},
        passing_score_threshold=60  # Junior: 60% to pass
    ),
    ExperienceConfig(
        min_years=4,
        max_years=6,
        difficulty_distribution={"easy": 0.2, "medium": 0.7, "hard": 0.1},
        passing_score_threshold=70  # Mid-level: 70% to pass
    ),
    ExperienceConfig(
        min_years=7,
        max_years=11,
        difficulty_distribution={"easy": 0.0, "medium": 0.5, "hard": 0.5},
        passing_score_threshold=75  # Senior: 75% to pass
    ),
    ExperienceConfig(
        min_years=12,
        max_years=50,
        difficulty_distribution={"easy": 0.0, "medium": 0.3, "hard": 0.7},
        passing_score_threshold=80  # Expert: 80% to pass
    ),
]


def parse_experience_years(experience_str: str) -> int:
    """
    Parse experience string to years integer.
    
    Examples:
        "5 years" -> 5
        "5" -> 5
        "5-7" -> 6 (midpoint)
        "7-11" -> 9 (midpoint)
        "12+ years" -> 12
    """
    try:
        # Remove common suffixes
        clean = experience_str.lower().replace("years", "").replace("year", "").strip()
        
        # Handle "12+" or "10+"
        if "+" in clean:
            return int(clean.replace("+", "").strip())
        
        # Handle ranges "5-7"
        if "-" in clean:
            parts = clean.split("-")
            min_years = int(parts[0].strip())
            max_years = int(parts[1].strip())
            return (min_years + max_years) // 2  # Return midpoint
        
        # Simple number
        return int(clean.strip())
    except (ValueError, IndexError):
        return 5  # Default to mid-level if parsing fails


def get_difficulty_distribution(experience_years: int) -> Dict[str, float]:
    """
    Get difficulty distribution based on experience years.
    
    Args:
        experience_years: Candidate's years of experience
        
    Returns:
        Dictionary with difficulty distribution: {"easy": 0.2, "medium": 0.5, "hard": 0.3}
    """
    for band in EXPERIENCE_BANDS:
        if band.min_years <= experience_years <= band.max_years:
            return band.difficulty_distribution.copy()
    
    # Default to expert if beyond all bands
    return EXPERIENCE_BANDS[-1].difficulty_distribution.copy()


def get_passing_score_threshold(experience_years: int) -> int:
    """
    Get passing score threshold based on experience years.
    
    Args:
        experience_years: Candidate's years of experience
        
    Returns:
        Passing score threshold as percentage (0-100)
    """
    for band in EXPERIENCE_BANDS:
        if band.min_years <= experience_years <= band.max_years:
            return band.passing_score_threshold
    
    # Default to expert threshold if beyond all bands
    return EXPERIENCE_BANDS[-1].passing_score_threshold


def calculate_question_count_per_difficulty(
    total_questions: int,
    difficulty_distribution: Dict[str, float]
) -> Dict[str, int]:
    """
    Calculate exact number of questions for each difficulty level.
    
    Args:
        total_questions: Total questions to generate
        difficulty_distribution: {"easy": 0.2, "medium": 0.5, "hard": 0.3}
        
    Returns:
        Dictionary with question counts: {"easy": 3, "medium": 7, "hard": 10}
    """
    result = {}
    remaining = total_questions
    difficulties = ["easy", "medium", "hard"]
    
    for i, difficulty in enumerate(difficulties):
        proportion = difficulty_distribution.get(difficulty, 0.0)
        
        if i == len(difficulties) - 1:
            # Last difficulty gets remaining questions to ensure total matches exactly
            result[difficulty] = remaining
        else:
            count = round(total_questions * proportion)
            result[difficulty] = count
            remaining -= count
    
    return result


def calculate_question_count_per_skill(
    total_questions: int,
    num_skills: int,
) -> Dict[str, int]:
    """
    Distribute questions evenly across skills.
    
    Args:
        total_questions: Total questions to generate
        num_skills: Number of skills to cover
        
    Returns:
        Questions per skill (roughly equal distribution)
    """
    base_count = total_questions // num_skills
    remainder = total_questions % num_skills
    
    # Each skill gets base_count, and first 'remainder' skills get +1
    return {
        f"skill_{i}": base_count + (1 if i < remainder else 0)
        for i in range(num_skills)
    }


def get_experience_level_label(experience_years: int) -> str:
    """
    Get a human-readable label for experience level.
    
    Args:
        experience_years: Years of experience
        
    Returns:
        Label like "junior", "mid-level", "senior", "expert"
    """
    if experience_years <= 3:
        return "junior"
    elif experience_years <= 6:
        return "mid-level"
    elif experience_years <= 11:
        return "senior"
    else:
        return "expert"


def validate_difficulty_distribution(distribution: Dict[str, float]) -> bool:
    """
    Validate that difficulty distribution sums to approximately 1.0.
    
    Args:
        distribution: {"easy": 0.2, "medium": 0.5, "hard": 0.3}
        
    Returns:
        True if valid, False otherwise
    """
    total = sum(distribution.get(d, 0.0) for d in ["easy", "medium", "hard"])
    return 0.99 <= total <= 1.01  # Allow small floating-point errors


def get_adjusted_difficulty_distribution(
    base_distribution: Dict[str, float],
    experience_years: int,
    auto_adjust: bool = True
) -> Dict[str, float]:
    """
    Get adjusted difficulty distribution based on experience.
    
    Args:
        base_distribution: Admin-configured base distribution
        experience_years: Candidate's experience
        auto_adjust: If True, override with experience-based distribution
        
    Returns:
        Final difficulty distribution to use
    """
    if auto_adjust:
        return get_difficulty_distribution(experience_years)
    else:
        return base_distribution


# Example usage and testing
if __name__ == "__main__":
    # Test experience parsing
    test_cases = [
        ("5 years", 5),
        ("5", 5),
        ("5-7", 6),
        ("7-11", 9),
        ("12+ years", 12),
    ]
    
    for exp_str, expected in test_cases:
        result = parse_experience_years(exp_str)
        print(f"parse_experience_years('{exp_str}') = {result} (expected {expected})")
    
    print("\n--- Experience Bands ---")
    for years in [2, 5, 9, 15]:
        dist = get_difficulty_distribution(years)
        threshold = get_passing_score_threshold(years)
        label = get_experience_level_label(years)
        print(f"{years} years ({label}): {dist} -> {threshold}% to pass")
    
    print("\n--- Question Distribution ---")
    total = 15
    dist = get_difficulty_distribution(5)
    counts = calculate_question_count_per_difficulty(total, dist)
    print(f"Total {total} questions with distribution {dist}:")
    print(f"  {counts}")
    print(f"  Actual sum: {sum(counts.values())}")
