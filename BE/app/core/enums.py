from enum import Enum


class QuestionType(str, Enum):
    MCQ = "MCQ"
    SCENARIO = "SCENARIO"