## Experience-Based Question Generation Implementation

This document explains the new experience-based question generation system that was added to the assessment platform.

---

## Overview

The system now **automatically adjusts question difficulty, distribution, and passing score thresholds** based on each candidate's years of experience. Questions are no longer one-size-fits-all—junior developers get easier questions, while experts get more challenging ones.

---

## Key Features

### 1. **Experience-Based Difficulty Mapping**

Experience is automatically mapped to four bands:

| Experience | Level | Difficulty Distribution | Passing Score |
|---|---|---|---|
| 0–3 years | Junior | 100% easy | 60% |
| 4–6 years | Mid-level | 20% easy, 70% medium, 10% hard | 70% |
| 7–11 years | Senior | 50% medium, 50% hard | 75% |
| 12+ years | Expert | 30% medium, 70% hard | 80% |

### 2. **Automatic Candidate Experience Parsing**

The system can parse various experience formats:
- `"5 years"` → 5 years
- `"5"` → 5 years
- `"5-7"` → 6 years (midpoint)
- `"7-11"` → 9 years (midpoint)
- `"12+ years"` → 12 years

### 3. **Configurable Assessment Settings**

Admins can configure:
- **Total questions**: Default 15, customizable per assessment
- **Question type mix**: Distribution of MCQ, coding, and architecture questions
- **Difficulty distribution**: Base distribution (can be overridden by experience)
- **Passing score threshold**: Base threshold (can be auto-adjusted)
- **Auto-adjust by experience**: Toggle to enable/disable experience-based adjustments

### 4. **Skill Coverage & Question Distribution**

- Questions are **evenly distributed** across selected skills
- Each skill receives approximately: `total_questions / num_skills`
- Difficulty is applied across all skills consistently

---

## Database Changes

### New Assessment Fields

Added to `assessments` table (migration: `20260106_002_experience_questions.py`):

```sql
-- Question configuration
total_questions INT DEFAULT 15
question_type_mix JSON DEFAULT '{"mcq": 0.5, "coding": 0.3, "architecture": 0.2}'

-- Scoring configuration
passing_score_threshold INT DEFAULT 70
auto_adjust_by_experience BOOLEAN DEFAULT true

-- Difficulty distribution
difficulty_distribution JSON DEFAULT '{"easy": 0.2, "medium": 0.5, "hard": 0.3}'
```

### Example Assessment Record

```json
{
  "assessment_id": "assess_abc123",
  "title": "Python Developer Assessment",
  "total_questions": 15,
  "question_type_mix": {
    "mcq": 0.5,
    "coding": 0.3,
    "architecture": 0.2
  },
  "passing_score_threshold": 70,
  "auto_adjust_by_experience": true,
  "difficulty_distribution": {
    "easy": 0.2,
    "medium": 0.5,
    "hard": 0.3
  },
  "required_skills": {
    "Python": "high",
    "System Design": "medium"
  }
}
```

---

## API Changes

### AssessmentCreate Schema

```python
class AssessmentCreate(BaseModel):
    title: str
    job_title: str
    # ... existing fields ...
    
    # NEW: Question configuration
    total_questions: int = 15
    question_type_mix: Optional[Dict[str, float]] = None
    
    # NEW: Scoring configuration
    passing_score_threshold: int = 70
    auto_adjust_by_experience: bool = True
    difficulty_distribution: Optional[Dict[str, float]] = None
```

### Example API Call

**POST /api/v1/assessments**

```json
{
  "title": "Python Developer Role",
  "job_title": "Senior Python Developer",
  "required_skills": {
    "Python": "high",
    "FastAPI": "high",
    "System Design": "medium"
  },
  "total_questions": 15,
  "question_type_mix": {
    "mcq": 0.5,
    "coding": 0.3,
    "architecture": 0.2
  },
  "passing_score_threshold": 70,
  "auto_adjust_by_experience": true,
  "difficulty_distribution": {
    "easy": 0.2,
    "medium": 0.5,
    "hard": 0.3
  }
}
```

---

## Core Utilities

### File: `app/utils/experience_based_questions.py`

Key functions:

#### **parse_experience_years(experience_str: str) → int**
Parses experience strings to years integer.

```python
parse_experience_years("5-7 years")  # Returns 6
```

#### **get_difficulty_distribution(experience_years: int) → Dict[str, float]**
Returns difficulty distribution based on experience.

```python
dist = get_difficulty_distribution(5)  # Returns {"easy": 0.2, "medium": 0.7, "hard": 0.1}
```

#### **get_passing_score_threshold(experience_years: int) → int**
Returns passing score threshold (0-100%).

```python
threshold = get_passing_score_threshold(5)  # Returns 70
```

#### **calculate_question_count_per_difficulty(total_questions, distribution) → Dict[str, int]**
Converts percentages to exact question counts.

```python
counts = calculate_question_count_per_difficulty(15, {"easy": 0.2, "medium": 0.5, "hard": 0.3})
# Returns {"easy": 3, "medium": 8, "hard": 4}
```

---

## Service Integration

### File: `app/services/assessment_generator.py`

#### **get_assessment_config_for_candidate(assessment, candidate) → Dict**

Gets the final configuration for a specific candidate:

```python
config = await get_assessment_config_for_candidate(assessment, candidate)
# Returns:
# {
#     "total_questions": 15,
#     "difficulty_distribution": {"easy": 0.2, "medium": 0.5, "hard": 0.3},
#     "passing_score_threshold": 70,
#     "question_counts_per_difficulty": {"easy": 3, "medium": 8, "hard": 4},
#     "experience_level": "mid-level",
#     "adjusted_by_experience": true
# }
```

#### **generate_questions_with_experience_config(assessment, candidate, skills) → Dict**

Generates LLM-ready prompt configuration:

```python
config = await generate_questions_with_experience_config(assessment, candidate)
# Returns config ready for passing to LLM question generator
```

---

## Usage Examples

### Example 1: Creating an Assessment

```python
from app.schemas import AssessmentCreate
from app.api.assessments import router

request = AssessmentCreate(
    title="Python Backend Engineer",
    job_title="Senior Backend Engineer",
    required_skills={"Python": "high", "FastAPI": "high", "System Design": "medium"},
    total_questions=20,
    question_type_mix={"mcq": 0.4, "coding": 0.4, "architecture": 0.2},
    passing_score_threshold=75,
    auto_adjust_by_experience=True,
    difficulty_distribution={"easy": 0.1, "medium": 0.5, "hard": 0.4}
)

assessment = await create_assessment(request)
```

### Example 2: Getting Assessment Config for Candidate

```python
from app.services import get_assessment_config_for_candidate

# For a candidate with 5 years experience
candidate_config = await get_assessment_config_for_candidate(assessment, candidate)

print(candidate_config["experience_level"])  # "mid-level"
print(candidate_config["difficulty_distribution"])  # {"easy": 0.2, "medium": 0.7, "hard": 0.1}
print(candidate_config["passing_score_threshold"])  # 70
print(candidate_config["question_counts_per_difficulty"])  # {"easy": 3, "medium": 10, "hard": 2}
```

### Example 3: Generating Questions for Different Candidates

```python
# Same assessment, three different candidates

# Junior candidate (2 years)
junior_config = await generate_questions_with_experience_config(assessment, junior_candidate)
# Questions will be 100% easy

# Mid-level candidate (5 years)
mid_config = await generate_questions_with_experience_config(assessment, mid_candidate)
# Questions will be 20% easy, 70% medium, 10% hard

# Senior candidate (10 years)
senior_config = await generate_questions_with_experience_config(assessment, senior_candidate)
# Questions will be 50% medium, 50% hard
```

---

## Testing

Tests are located in: `BE/tests/test_experience_questions.py`

### Running Tests

```bash
# Run all experience-based question tests
pytest BE/tests/test_experience_questions.py -v

# Run specific test class
pytest BE/tests/test_experience_questions.py::TestDifficultyDistribution -v

# Run with coverage
pytest BE/tests/test_experience_questions.py --cov=app.utils.experience_based_questions
```

### Test Coverage

- ✅ Experience parsing (simple numbers, ranges, years suffix, + notation)
- ✅ Difficulty distribution mapping (all four experience bands)
- ✅ Passing score threshold calculation
- ✅ Question count distribution per difficulty
- ✅ Experience level labels
- ✅ Distribution validation
- ✅ Edge cases (0 years, 100+ years, single question)

---

## Integration Points

### 1. Admin Dashboard (FE)

When creating/editing an assessment:

```
┌─────────────────────────────────────┐
│ Assessment Configuration            │
├─────────────────────────────────────┤
│ Title: [________________]            │
│ Job Title: [________________]        │
│ Required Skills: [_________________] │
│                                     │
│ QUESTION CONFIGURATION              │
│ Total Questions: [15]               │
│ Question Type Mix:                  │
│   MCQ: [50]%                        │
│   Coding: [30]%                     │
│   Architecture: [20]%               │
│                                     │
│ SCORING CONFIGURATION               │
│ Base Passing Score: [70]%           │
│ ☑ Auto-adjust by experience         │
│                                     │
│ DEFAULT DIFFICULTY DISTRIBUTION     │
│ Easy: [20]%                         │
│ Medium: [50]%                       │
│ Hard: [30]%                         │
│                                     │
│ [Save Assessment]                   │
└─────────────────────────────────────┘
```

### 2. Candidate Assessment Flow

```
Candidate Profile (experience extracted)
        ↓
Admin creates Assessment (with settings)
        ↓
Candidate takes Assessment
        ↓
System calls: get_assessment_config_for_candidate(assessment, candidate)
        ↓
Experience-based config generated
        ↓
Questions generated with adjusted difficulty
        ↓
Candidate answers questions
        ↓
Scoring uses experience-adjusted passing threshold
```

### 3. Backend Assessment API

```python
# In app/api/assessments.py

@router.post("/assessments", response_model=AssessmentResponse)
async def create_assessment(request: AssessmentCreate, session: AsyncSession):
    # New fields are now part of the request
    assessment = Assessment(
        # ... existing fields ...
        total_questions=request.total_questions,
        question_type_mix=request.question_type_mix or {"mcq": 0.5, "coding": 0.3, "architecture": 0.2},
        passing_score_threshold=request.passing_score_threshold,
        auto_adjust_by_experience=request.auto_adjust_by_experience,
        difficulty_distribution=request.difficulty_distribution or {"easy": 0.2, "medium": 0.5, "hard": 0.3},
    )
    session.add(assessment)
    await session.commit()
    return assessment
```

---

## Migration Instructions

### 1. Apply Database Migration

```bash
cd BE
alembic upgrade head
```

This will add the new columns to the `assessments` table with appropriate defaults.

### 2. Verify Schema

```sql
-- Check new columns in PostgreSQL
\d+ assessments

-- Should show:
-- total_questions | integer | default 15
-- question_type_mix | json | default '{"mcq": 0.5, "coding": 0.3, "architecture": 0.2}'
-- passing_score_threshold | integer | default 70
-- auto_adjust_by_experience | boolean | default true
-- difficulty_distribution | json | default '{"easy": 0.2, "medium": 0.5, "hard": 0.3}'
```

### 3. Backward Compatibility

✅ **Fully backward compatible**: All new fields have defaults, so existing code continues to work.

---

## Configuration Recommendations

### For Junior Developers

```json
{
  "total_questions": 15,
  "question_type_mix": {"mcq": 0.8, "coding": 0.2, "architecture": 0.0},
  "passing_score_threshold": 60,
  "auto_adjust_by_experience": true,
  "difficulty_distribution": {"easy": 1.0, "medium": 0.0, "hard": 0.0}
}
```

### For Mid-Level Developers

```json
{
  "total_questions": 20,
  "question_type_mix": {"mcq": 0.5, "coding": 0.3, "architecture": 0.2},
  "passing_score_threshold": 70,
  "auto_adjust_by_experience": true,
  "difficulty_distribution": {"easy": 0.2, "medium": 0.7, "hard": 0.1}
}
```

### For Senior Developers

```json
{
  "total_questions": 20,
  "question_type_mix": {"mcq": 0.3, "coding": 0.3, "architecture": 0.4},
  "passing_score_threshold": 75,
  "auto_adjust_by_experience": true,
  "difficulty_distribution": {"easy": 0.0, "medium": 0.5, "hard": 0.5}
}
```

---

## Future Enhancements

1. **Analytics Dashboard**
   - Track which question types filter out candidates at each experience level
   - Identify questions that are too easy/hard for specific experience bands

2. **Dynamic Adjustment**
   - Adjust difficulty mid-assessment based on candidate performance
   - Adaptive testing (harder questions if doing well)

3. **Skill-Specific Thresholds**
   - Different thresholds for different skills
   - E.g., higher threshold for critical skills

4. **Role-Based Templates**
   - Pre-configured templates for common roles (Junior, Mid, Senior, Lead)
   - One-click setup for standard assessments

---

## Files Changed/Added

### New Files
- `BE/app/utils/experience_based_questions.py` — Core experience logic
- `BE/app/services/assessment_generator.py` — Service integration
- `BE/app/services/__init__.py` — Services package
- `BE/tests/test_experience_questions.py` — Comprehensive tests
- `BE/alembic/versions/20260106_002_experience_questions.py` — Database migration

### Modified Files
- `BE/app/db/models.py` — Added fields to Assessment model
- `BE/app/models/schemas.py` — Updated AssessmentCreate, AssessmentUpdate, AssessmentResponse

---

## Support & Questions

For questions about this implementation, refer to:
1. `BE/app/utils/experience_based_questions.py` — Detailed docstrings and examples
2. `BE/app/services/assessment_generator.py` — Integration patterns
3. `BE/tests/test_experience_questions.py` — Test cases as examples
