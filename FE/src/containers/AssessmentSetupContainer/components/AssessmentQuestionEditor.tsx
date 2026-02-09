import React, { useState } from "react";
import {
  Box,
  Typography,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  IconButton,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Alert,
  RadioGroup,
  FormControlLabel,
  Radio,
} from "@mui/material";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  DragIndicator as DragIcon,
  ExpandMore as ExpandMoreIcon,
  ContentCopy as CopyIcon,
} from "@mui/icons-material";
import "./AssessmentQuestionEditor.scss";

export interface QuestionOption {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  type: "mcq" | "coding" | "architecture" | "screening";
  question_text: string;
  difficulty: "easy" | "medium" | "hard";
  skill?: string;
  options?: QuestionOption[];
  correct_answer?: string | string[];  // ✅ Support multiple correct answers
  is_multi_select?: boolean;  // ✅ NEW: Flag for multi-select MCQ
  code_template?: string;
  constraints?: string[];
  test_cases?: any[];
  time_limit?: number;
}

interface Props {
  questions: Question[];
  onQuestionsChange: (questions: Question[]) => void;
}

const AssessmentQuestionEditor: React.FC<Props> = ({
  questions,
  onQuestionsChange,
}) => {
  const [expandedQuestion, setExpandedQuestion] = useState<string | false>(false);
  const [questionTypeFilter, setQuestionTypeFilter] = useState<string>("all");

  const updateQuestions = (newQuestions: Question[]) => {
    onQuestionsChange(newQuestions);
  };

  const generateQuestionId = () => `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const addQuestion = (type: Question["type"]) => {
    console.log("Adding question of type:", type);
    const newQuestion: Question = {
      id: generateQuestionId(),
      type,
      question_text: "",
      difficulty: "medium",
      skill: "",
    };

    if (type === "mcq") {
      newQuestion.options = [
        { id: "A", text: "" },
        { id: "B", text: "" },
        { id: "C", text: "" },
        { id: "D", text: "" },
      ];
      newQuestion.correct_answer = "";
    }

    if (type === "coding") {
      newQuestion.code_template = "// Write your code here\n";
      newQuestion.constraints = [];
      newQuestion.test_cases = [];
      newQuestion.time_limit = 30;
    }

    const newQuestions = [...questions, newQuestion];
    console.log("New questions array:", newQuestions);
    updateQuestions(newQuestions);
    setExpandedQuestion(newQuestion.id);
  };

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    const newQuestions = questions.map((q) => (q.id === id ? { ...q, ...updates } : q));
    updateQuestions(newQuestions);
  };

  const deleteQuestion = (id: string) => {
    if (window.confirm("Are you sure you want to delete this question?")) {
      const newQuestions = questions.filter((q) => q.id !== id);
      updateQuestions(newQuestions);
    }
  };

  const duplicateQuestion = (question: Question) => {
    const duplicated = {
      ...question,
      id: generateQuestionId(),
      question_text: `${question.question_text} (Copy)`,
    };
    const newQuestions = [...questions, duplicated];
    updateQuestions(newQuestions);
  };

  const updateOption = (questionId: string, optionId: string, text: string) => {
    const newQuestions = questions.map((q) => {
        if (q.id === questionId && q.options) {
          return {
            ...q,
            options: q.options.map((opt) =>
              opt.id === optionId ? { ...opt, text } : opt
            ),
          };
        }
        return q;
      });
    updateQuestions(newQuestions);
  };

  const addOption = (questionId: string) => {
    const newQuestions = questions.map((q) => {
        if (q.id === questionId && q.options) {
          const nextLetter = String.fromCharCode(65 + q.options.length);
          return {
            ...q,
            options: [...q.options, { id: nextLetter, text: "" }],
          };
        }
        return q;
      });
    updateQuestions(newQuestions);
  };

  const removeOption = (questionId: string, optionId: string) => {
    const newQuestions = questions.map((q) => {
        if (q.id === questionId && q.options) {
          return {
            ...q,
            options: q.options.filter((opt) => opt.id !== optionId),
          };
        }
        return q;
      });
    updateQuestions(newQuestions);
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      mcq: "#1976d2",
      coding: "#7b1fa2",
      architecture: "#f57c00",
      screening: "#388e3c",
    };
    return colors[type] || "#666";
  };

  const getDifficultyColor = (difficulty: string) => {
    const colors: Record<string, string> = {
      easy: "#4caf50",
      medium: "#ff9800",
      hard: "#f44336",
    };
    return colors[difficulty] || "#666";
  };

  const filteredQuestions = questionTypeFilter === "all" 
    ? questions 
    : questions.filter((q) => q.type === questionTypeFilter);

  return (
    <Box className="assessment-question-editor">
      {/* Header */}
      <Box sx={{ marginBottom: "2rem" }}>
        <Typography variant="h5" sx={{ fontWeight: 700, marginBottom: "1rem" }}>
          Assessment Questions
        </Typography>

        {/* Add Question Buttons */}
        <Box sx={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => addQuestion("mcq")}
            sx={{
              background: "linear-gradient(135deg, #1976d2 0%, #1565c0 100%)",
              textTransform: "none",
            }}
          >
            Add MCQ
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => addQuestion("coding")}
            sx={{
              background: "linear-gradient(135deg, #7b1fa2 0%, #6a1b9a 100%)",
              textTransform: "none",
            }}
          >
            Add Coding
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => addQuestion("architecture")}
            sx={{
              background: "linear-gradient(135deg, #f57c00 0%, #e65100 100%)",
              textTransform: "none",
            }}
          >
            Add Architecture
          </Button>
          {/* <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => addQuestion("screening")}
            sx={{
              background: "linear-gradient(135deg, #388e3c 0%, #2e7d32 100%)",
              textTransform: "none",
            }}
          >
            Add Screening
          </Button> */}
        </Box>

        {/* Filter */}
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Filter by Type</InputLabel>
          <Select
            value={questionTypeFilter}
            onChange={(e) => setQuestionTypeFilter(e.target.value)}
            label="Filter by Type"
          >
            <MenuItem value="all">All Questions</MenuItem>
            <MenuItem value="mcq">MCQ Only</MenuItem>
            <MenuItem value="coding">Coding Only</MenuItem>
            <MenuItem value="architecture">Architecture Only</MenuItem>
            <MenuItem value="screening">Screening Only</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Question Count */}
      <Alert severity="info" sx={{ marginBottom: "2rem" }}>
        Total Questions: <strong>{questions.length}</strong> (
        MCQ: {questions.filter((q) => q.type === "mcq").length}, 
        Coding: {questions.filter((q) => q.type === "coding").length}, 
        Architecture: {questions.filter((q) => q.type === "architecture").length}, 
        Screening: {questions.filter((q) => q.type === "screening").length})
      </Alert>

      {/* Questions List */}
      {filteredQuestions.length === 0 ? (
        <Paper sx={{ padding: "3rem", textAlign: "center", borderRadius: "12px" }}>
          <Typography variant="h6" color="textSecondary">
            No questions added yet
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ marginTop: "0.5rem" }}>
            Click the buttons above to add questions to your assessment
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {filteredQuestions.map((question, index) => (
            <Accordion
              key={question.id}
              expanded={expandedQuestion === question.id}
              onChange={(_, isExpanded) =>
                setExpandedQuestion(isExpanded ? question.id : false)
              }
              sx={{ borderRadius: "8px !important", border: "1px solid #e0e0e0" }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: "flex", alignItems: "center", gap: "1rem", width: "100%" }}>
                  <DragIcon sx={{ color: "#999", cursor: "move" }} />
                  
                  <Box sx={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <Chip
                      label={`Q${index + 1}`}
                      size="small"
                      sx={{ fontWeight: 700 }}
                    />
                    <Chip
                      label={question.type.toUpperCase()}
                      size="small"
                      sx={{
                        backgroundColor: getTypeColor(question.type),
                        color: "white",
                        fontWeight: 600,
                      }}
                    />
                    <Chip
                      label={question.difficulty}
                      size="small"
                      sx={{
                        backgroundColor: getDifficultyColor(question.difficulty),
                        color: "white",
                        fontWeight: 600,
                      }}
                    />
                  </Box>
                  
                  <Typography sx={{ flex: 1, marginLeft: "1rem" }}>
                    {question.question_text || <em>Untitled Question</em>}
                  </Typography>
                  
                  <Box sx={{ display: "flex", gap: "0.5rem" }} onClick={(e) => e.stopPropagation()}>
                    <IconButton
                      size="small"
                      onClick={() => duplicateQuestion(question)}
                      title="Duplicate"
                    >
                      <CopyIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => deleteQuestion(question.id)}
                      title="Delete"
                      color="error"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              </AccordionSummary>

              <AccordionDetails>
                <Box sx={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                  {/* Basic Info */}
                  <Box sx={{ display: "grid", gridTemplateColumns: "1fr", gap: 2 }}>
                    <TextField
                      fullWidth
                      label="Question Text"
                      multiline
                      rows={4}
                      value={question.question_text}
                      onChange={(e) =>
                        updateQuestion(question.id, { question_text: e.target.value })
                      }
                      placeholder="Enter the question here..."
                    />
                    
                    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                      <FormControl fullWidth>
                        <InputLabel>Difficulty</InputLabel>
                        <Select
                          value={question.difficulty}
                          onChange={(e) =>
                            updateQuestion(question.id, {
                              difficulty: e.target.value as any,
                            })
                          }
                          label="Difficulty"
                        >
                          <MenuItem value="easy">Easy</MenuItem>
                          <MenuItem value="medium">Medium</MenuItem>
                          <MenuItem value="hard">Hard</MenuItem>
                        </Select>
                      </FormControl>
                    
                      <TextField
                        fullWidth
                        label="Skill/Topic"
                        value={question.skill || ""}
                        onChange={(e) =>
                          updateQuestion(question.id, { skill: e.target.value })
                        }
                        placeholder="e.g., JavaScript, React, Algorithms"
                      />
                    </Box>
                  </Box>

                  <Divider />

                  {/* MCQ Options */}
                  {question.type === "mcq" && (
                    <Box>
                      <Typography variant="h6" sx={{ marginBottom: "1rem", fontWeight: 600 }}>
                        Answer Options
                      </Typography>
                      
                      <RadioGroup
                        value={question.correct_answer || ""}
                        onChange={(e) =>
                          updateQuestion(question.id, { correct_answer: e.target.value })
                        }
                      >
                        {question.options?.map((option) => (
                          <Box
                            key={option.id}
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: "1rem",
                              marginBottom: "1rem",
                            }}
                          >
                            <FormControlLabel
                              value={option.id}
                              control={<Radio />}
                              label=""
                              sx={{ margin: 0 }}
                            />
                            <TextField
                              fullWidth
                              label={`Option ${option.id}`}
                              value={option.text}
                              onChange={(e) =>
                                updateOption(question.id, option.id, e.target.value)
                              }
                              placeholder={`Enter option ${option.id}`}
                            />
                            {question.options && question.options.length > 2 && (
                              <IconButton
                                size="small"
                                onClick={() => removeOption(question.id, option.id)}
                                color="error"
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            )}
                          </Box>
                        ))}
                      </RadioGroup>
                      
                      <Button
                        startIcon={<AddIcon />}
                        onClick={() => addOption(question.id)}
                        sx={{ textTransform: "none" }}
                      >
                        Add Option
                      </Button>
                      
                      {!question.correct_answer && (
                        <Alert severity="warning" sx={{ marginTop: "1rem" }}>
                          Please select the correct answer
                        </Alert>
                      )}
                    </Box>
                  )}

                  {/* Coding Question Details */}
                  {question.type === "coding" && (
                    <Box>
                      <Typography variant="h6" sx={{ marginBottom: "1rem", fontWeight: 600 }}>
                        Coding Details
                      </Typography>
                      
                      <Box sx={{ display: "grid", gridTemplateColumns: "1fr", gap: 2 }}>
                        <TextField
                          fullWidth
                          label="Code Template"
                          multiline
                          rows={6}
                          value={question.code_template || ""}
                          onChange={(e) =>
                            updateQuestion(question.id, { code_template: e.target.value })
                          }
                          placeholder="// Initial code template for candidates"
                          sx={{ fontFamily: "monospace" }}
                        />
                        
                        <TextField
                          fullWidth
                          label="Time Limit (minutes)"
                          type="number"
                          value={question.time_limit || 30}
                          onChange={(e) =>
                            updateQuestion(question.id, {
                              time_limit: parseInt(e.target.value),
                            })
                          }
                        />
                      </Box>
                    </Box>
                  )}

                  {/* Architecture/Screening */}
                  {(question.type === "architecture" || question.type === "screening") && (
                    <Alert severity="info">
                      This is a free-text question. Candidates will provide written answers that
                      need manual review.
                    </Alert>
                  )}
                </Box>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default AssessmentQuestionEditor;
