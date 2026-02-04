import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Card,
  CardContent,
  CircularProgress,
  Alert,
} from "@mui/material";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Visibility as VisibilityIcon,
} from "@mui/icons-material";
import { questionGenService } from "../../API/services";
import Toast from "../../components/Toast/Toast";
import "./QuestionBankContainer.scss";

interface Question {
  id: number;
  question_text: string;
  question_type: string;
  difficulty: string;
  options?: Record<string, string>;
  correct_answer?: string;
  skill?: string;
  status?: string;
  created_at?: string;
}

const QuestionBankContainer: React.FC = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [filteredQuestions, setFilteredQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterDifficulty, setFilterDifficulty] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  
  // Dialog states
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openPreviewDialog, setOpenPreviewDialog] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  
  // New question form
  const [newQuestion, setNewQuestion] = useState<Partial<Question>>({
    question_text: "",
    question_type: "mcq",
    difficulty: "medium",
    options: {},
    correct_answer: "",
    skill: "",
  });

  useEffect(() => {
    fetchQuestions();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [questions, searchQuery, filterType, filterDifficulty, filterStatus]);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const data = await questionGenService.listDrafts(filterStatus === "all" ? undefined : filterStatus);
      setQuestions(data);
    } catch (error) {
      console.error("Error fetching questions:", error);
      setToast({ type: "error", message: "Failed to load questions" });
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...questions];

    // Search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter((q) =>
        q.question_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (q.skill && q.skill.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Type filter
    if (filterType !== "all") {
      filtered = filtered.filter((q) => q.question_type === filterType);
    }

    // Difficulty filter
    if (filterDifficulty !== "all") {
      filtered = filtered.filter((q) => q.difficulty === filterDifficulty);
    }

    // Status filter
    if (filterStatus !== "all") {
      filtered = filtered.filter((q) => q.status === filterStatus);
    }

    setFilteredQuestions(filtered);
  };

  const handleAddQuestion = async () => {
    try {
      // Call API to add question
      setToast({ type: "success", message: "Question added successfully" });
      setOpenAddDialog(false);
      setNewQuestion({
        question_text: "",
        question_type: "mcq",
        difficulty: "medium",
        options: {},
        correct_answer: "",
        skill: "",
      });
      fetchQuestions();
    } catch (error) {
      setToast({ type: "error", message: "Failed to add question" });
    }
  };

  const handleDeleteQuestion = async () => {
    if (!window.confirm("Are you sure you want to delete this question?")) return;
    
    try {
      // Call API to delete question
      setToast({ type: "success", message: "Question deleted successfully" });
      fetchQuestions();
    } catch (error) {
      setToast({ type: "error", message: "Failed to delete question" });
    }
  };

  const handlePublishQuestion = async (id: number) => {
    try {
      await questionGenService.publishDraft(id);
      setToast({ type: "success", message: "Question published successfully" });
      fetchQuestions();
    } catch (error) {
      setToast({ type: "error", message: "Failed to publish question" });
    }
  };

  const handleExportQuestions = () => {
    const csv = convertToCSV(filteredQuestions);
    downloadCSV(csv, "questions-export.csv");
    setToast({ type: "success", message: "Questions exported successfully" });
  };

  const convertToCSV = (data: Question[]) => {
    const headers = ["ID", "Question", "Type", "Difficulty", "Skill", "Status"];
    const rows = data.map((q) => [
      q.id,
      `"${q.question_text.replace(/"/g, '""')}"`,
      q.question_type,
      q.difficulty,
      q.skill || "",
      q.status || "draft",
    ]);
    
    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  };

  const downloadCSV = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
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

  return (
    <Box className="question-bank-container" sx={{ padding: "2rem", minHeight: "100vh", backgroundColor: "#f5f7fa" }}>
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
      
      {/* Header */}
      <Box sx={{ marginBottom: "2rem" }}>
        <Typography variant="h4" sx={{ fontWeight: 700, marginBottom: "0.5rem" }}>
          Question Bank Management
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Manage, organize, and analyze your assessment questions
        </Typography>
      </Box>

      {/* Actions Bar */}
      <Paper sx={{ padding: "1.5rem", marginBottom: "2rem", borderRadius: "12px" }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "2fr 1fr 1fr 1fr 1fr" }, gap: 2, marginBottom: 2 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search questions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ marginRight: "0.5rem", color: "#999" }} />,
            }}
          />
          
          <FormControl fullWidth size="small">
            <InputLabel>Type</InputLabel>
            <Select value={filterType} onChange={(e) => setFilterType(e.target.value)} label="Type">
                <MenuItem value="all">All Types</MenuItem>
                <MenuItem value="mcq">MCQ</MenuItem>
                <MenuItem value="coding">Coding</MenuItem>
                <MenuItem value="architecture">Architecture</MenuItem>
                <MenuItem value="screening">Screening</MenuItem>
              </Select>
            </FormControl>
          
          <FormControl fullWidth size="small">
            <InputLabel>Difficulty</InputLabel>
            <Select value={filterDifficulty} onChange={(e) => setFilterDifficulty(e.target.value)} label="Difficulty">
              <MenuItem value="all">All Levels</MenuItem>
              <MenuItem value="easy">Easy</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="hard">Hard</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl fullWidth size="small">
            <InputLabel>Status</InputLabel>
            <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} label="Status">
              <MenuItem value="all">All Status</MenuItem>
              <MenuItem value="draft">Draft</MenuItem>
              <MenuItem value="published">Published</MenuItem>
            </Select>
          </FormControl>
          
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenAddDialog(true)}
            fullWidth
            sx={{
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              textTransform: "none",
            }}
          >
            Add
          </Button>
        </Box>
        
        <Box sx={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExportQuestions}
            size="small"
            sx={{ textTransform: "none" }}
          >
            Export CSV
          </Button>
          <Button
            variant="outlined"
            startIcon={<UploadIcon />}
            size="small"
            sx={{ textTransform: "none" }}
          >
            Import CSV
          </Button>
        </Box>
      </Paper>

      {/* Statistics Cards */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 2, marginBottom: "2rem" }}>
        <Card sx={{ borderRadius: "12px", background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}>
          <CardContent>
            <Typography variant="h4" sx={{ color: "white", fontWeight: 700 }}>{questions.length}</Typography>
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.9)" }}>Total Questions</Typography>
          </CardContent>
        </Card>
        
        <Card sx={{ borderRadius: "12px", background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" }}>
          <CardContent>
            <Typography variant="h4" sx={{ color: "white", fontWeight: 700 }}>
              {questions.filter((q) => q.status === "published").length}
            </Typography>
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.9)" }}>Published</Typography>
          </CardContent>
        </Card>
        
        <Card sx={{ borderRadius: "12px", background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)" }}>
          <CardContent>
            <Typography variant="h4" sx={{ color: "white", fontWeight: 700 }}>
                {questions.filter((q) => q.status === "draft").length}
              </Typography>
              <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.9)" }}>Drafts</Typography>
            </CardContent>
          </Card>
        
        <Card sx={{ borderRadius: "12px", background: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)" }}>
          <CardContent>
            <Typography variant="h4" sx={{ color: "white", fontWeight: 700 }}>
              {new Set(questions.map((q) => q.skill)).size}
            </Typography>
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.9)" }}>Skills Covered</Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Questions List */}
      <Paper sx={{ borderRadius: "12px", padding: "1.5rem" }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
            <CircularProgress />
          </Box>
        ) : filteredQuestions.length === 0 ? (
          <Box sx={{ textAlign: "center", padding: "3rem" }}>
            <Typography variant="h6" color="textSecondary">No questions found</Typography>
            <Typography variant="body2" color="textSecondary" sx={{ marginTop: "0.5rem" }}>
              Try adjusting your filters or add new questions
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {filteredQuestions.map((question) => (
              <Card key={question.id} sx={{ borderRadius: "8px", border: "1px solid #e0e0e0" }}>
                <CardContent>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
                        <Chip
                          label={question.question_type.toUpperCase()}
                          size="small"
                          sx={{
                            backgroundColor: getTypeColor(question.question_type),
                            color: "white",
                            fontWeight: 600,
                            fontSize: "0.6875rem",
                          }}
                        />
                        <Chip
                          label={question.difficulty}
                          size="small"
                          sx={{
                            backgroundColor: getDifficultyColor(question.difficulty),
                            color: "white",
                            fontWeight: 600,
                            fontSize: "0.6875rem",
                          }}
                        />
                        {question.skill && (
                          <Chip
                            label={question.skill}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: "0.6875rem" }}
                          />
                        )}
                        <Chip
                          label={question.status || "draft"}
                          size="small"
                          variant="outlined"
                          color={question.status === "published" ? "success" : "default"}
                          sx={{ fontSize: "0.6875rem" }}
                        />
                      </Box>
                      
                      <Typography variant="body1" sx={{ fontWeight: 600, marginBottom: "0.5rem" }}>
                        {question.question_text.substring(0, 150)}
                        {question.question_text.length > 150 && "..."}
                      </Typography>
                      
                      {question.options && Object.keys(question.options).length > 0 && (
                        <Box sx={{ marginTop: "0.5rem" }}>
                          <Typography variant="caption" color="textSecondary">
                            {Object.keys(question.options).length} options
                          </Typography>
                        </Box>
                      )}
                    </Box>
                    
                    <Box sx={{ display: "flex", gap: "0.5rem" }}>
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSelectedQuestion(question);
                          setOpenPreviewDialog(true);
                        }}
                        sx={{ color: "#1976d2" }}
                      >
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                    
                        onClick={() => handleDeleteQuestion()}
                        sx={{ color: "#d32f2f" }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                      {question.status === "draft" && (
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => handlePublishQuestion(question.id)}
                          sx={{
                            textTransform: "none",
                            fontSize: "0.75rem",
                            padding: "0.25rem 0.75rem",
                          }}
                        >
                          Publish
                        </Button>
                      )}
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>
        )}
      </Paper>

      {/* Add Question Dialog */}
      <Dialog open={openAddDialog} onClose={() => setOpenAddDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add New Question</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1rem" }}>
            <TextField
              label="Question Text"
              multiline
              rows={4}
              fullWidth
              value={newQuestion.question_text}
              onChange={(e) => setNewQuestion({ ...newQuestion, question_text: e.target.value })}
            />
            
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Question Type</InputLabel>
                <Select
                  value={newQuestion.question_type}
                  onChange={(e) => setNewQuestion({ ...newQuestion, question_type: e.target.value })}
                  label="Question Type"
                >
                  <MenuItem value="mcq">Multiple Choice</MenuItem>
                  <MenuItem value="coding">Coding</MenuItem>
                  <MenuItem value="architecture">Architecture</MenuItem>
                  <MenuItem value="screening">Screening</MenuItem>
                  </Select>
                </FormControl>
              
                <FormControl fullWidth>
                  <InputLabel>Difficulty</InputLabel>
                  <Select
                    value={newQuestion.difficulty}
                    onChange={(e) => setNewQuestion({ ...newQuestion, difficulty: e.target.value })}
                    label="Difficulty"
                  >
                    <MenuItem value="easy">Easy</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="hard">Hard</MenuItem>
                  </Select>
                </FormControl>
            </Box>
            
            <TextField
              label="Skill/Topic"
              fullWidth
              value={newQuestion.skill}
              onChange={(e) => setNewQuestion({ ...newQuestion, skill: e.target.value })}
            />
            
            {newQuestion.question_type === "mcq" && (
              <>
                <Alert severity="info">Add MCQ options below (A, B, C, D)</Alert>
                {/* Add option inputs here */}
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAddDialog(false)}>Cancel</Button>
          <Button onClick={handleAddQuestion} variant="contained">Add Question</Button>
        </DialogActions>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={openPreviewDialog} onClose={() => setOpenPreviewDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Question Preview</DialogTitle>
        <DialogContent>
          {selectedQuestion && (
            <Box sx={{ padding: "1rem" }}>
              <Box sx={{ marginBottom: "1rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <Chip label={selectedQuestion.question_type.toUpperCase()} color="primary" size="small" />
                <Chip label={selectedQuestion.difficulty} size="small" />
                {selectedQuestion.skill && <Chip label={selectedQuestion.skill} variant="outlined" size="small" />}
              </Box>
              
              <Typography variant="h6" sx={{ marginBottom: "1rem" }}>
                {selectedQuestion.question_text}
              </Typography>
              
              {selectedQuestion.options && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {Object.entries(selectedQuestion.options).map(([key, value]) => (
                    <Paper
                      key={key}
                      sx={{
                        padding: "1rem",
                        border: key === selectedQuestion.correct_answer ? "2px solid #4caf50" : "1px solid #e0e0e0",
                        backgroundColor: key === selectedQuestion.correct_answer ? "#e8f5e9" : "white",
                      }}
                    >
                      <Typography>
                        <strong>{key}.</strong> {value}
                      </Typography>
                    </Paper>
                  ))}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenPreviewDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default QuestionBankContainer;
