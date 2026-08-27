import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
  Snackbar,
  Backdrop,
  CircularProgress,
  IconButton,
  Collapse,
  Divider,
  Tabs,
  Tab,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { AxiosError } from "axios";
import { onboardingModuleService } from "../../API/onboarding_module.service";
import "./AdminOnboardingQuizUpload.scss";

type QuestionForm = {
  id?: number;
  question_text: string;
  question_type: string;
  choices: string[];
  correct_answer: string;
  variant: string;
  priority: number;
  saving: boolean;
};

type VariantForm = {
  variant: string;
  questions: QuestionForm[];
};

type ModuleForm = {
  id: number;
  title: string;
  rank: number;
  expanded: boolean;
  variants: VariantForm[];
};

const emptyQuestion = (variant: string): QuestionForm => ({
  question_text: "",
  question_type: "MCQ",
  choices: ["", "", "", ""],
  correct_answer: "",
  variant,
  priority: 0,
  saving: false,
});

const AdminOnboardingQuizUpload = () => {
  const [modules, setModules] = useState<ModuleForm[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [snackOpen, setSnackOpen] = useState(false);

  const loadModules = async () => {
    setLoading(true);
    setError(null);
    try {
      const [modulesData, quizData] = await Promise.all([
        onboardingModuleService.listOnboardingModules(),
        onboardingModuleService.getCurrentAdminQuiz(),
      ]);

      const moduleForms: ModuleForm[] = modulesData.map((m) => {
        const quizModule = quizData.modules.find((qm) => qm.module_id === m.id);
        const variants: VariantForm[] = [];
        if (quizModule && quizModule.variants.length > 0) {
          for (const v of quizModule.variants) {
            variants.push({
              variant: v.variant,
              questions: v.questions.map((q) => ({
                id: q.id,
                question_text: q.question_text,
                question_type: q.question_type,
                choices: q.choices && q.choices.length > 0 ? q.choices : ["", "", "", ""],
                correct_answer: q.correct_answer || "",
                variant: q.variant,
                priority: q.priority ?? 0,
                saving: false,
              })),
            });
          }
        }
        return {
          id: m.id,
          title: m.title,
          rank: m.rank,
          expanded: false,
          variants,
        };
      });

      setModules(moduleForms);
    } catch (err) {
      setError("Failed to load modules and quiz data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadModules();
  }, []);

  const showMessage = (message: string) => {
    setSuccess(message);
    setSnackOpen(true);
  };

  const updateModule = (index: number, updates: Partial<ModuleForm>) => {
    setModules((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  const updateVariant = (moduleIndex: number, variantIndex: number, updates: Partial<VariantForm>) => {
    setModules((prev) => {
      const next = [...prev];
      const module = { ...next[moduleIndex] };
      const variants = module.variants.map((v, i) => (i === variantIndex ? { ...v, ...updates } : v));
      module.variants = variants;
      next[moduleIndex] = module;
      return next;
    });
  };

  const updateQuestion = (
    moduleIndex: number,
    variantIndex: number,
    questionIndex: number,
    updates: Partial<QuestionForm>
  ) => {
    setModules((prev) => {
      const next = [...prev];
      const module = { ...next[moduleIndex] };
      const variants = module.variants.map((v, vi) => {
        if (vi !== variantIndex) return v;
        const questions = v.questions.map((q, qi) => (qi === questionIndex ? { ...q, ...updates } : q));
        return { ...v, questions };
      });
      module.variants = variants;
      next[moduleIndex] = module;
      return next;
    });
  };

  const addVariant = (moduleIndex: number) => {
    setModules((prev) => {
      const next = [...prev];
      const module = { ...next[moduleIndex] };
      const existingVariants = module.variants.map((v) => parseInt(v.variant, 10)).filter((n) => !isNaN(n));
      const existingSet = new Set(existingVariants);
      let nextVariant = "1";
      for (let i = 1; i <= existingVariants.length + 1; i++) {
        if (!existingSet.has(i)) {
          nextVariant = String(i);
          break;
        }
      }
      module.variants = [...module.variants, { variant: nextVariant, questions: [] }];
      next[moduleIndex] = module;
      return next;
    });
  };

  const addQuestion = (moduleIndex: number, variantIndex: number) => {
    setModules((prev) => {
      const next = [...prev];
      const module = { ...next[moduleIndex] };
      const variants = module.variants.map((v, vi) => {
        if (vi !== variantIndex) return v;
        return { ...v, questions: [...v.questions, emptyQuestion(v.variant)] };
      });
      module.variants = variants;
      next[moduleIndex] = module;
      return next;
    });
  };

  const deleteVariant = async (moduleIndex: number, variantIndex: number) => {
    const module = modules[moduleIndex];
    const variant = module.variants[variantIndex];
    if (!confirm(`Delete variant ${variant.variant} and all its questions?`)) return;

    const remainingVariants = module.variants.filter((_, i) => i !== variantIndex);
    const allQuestions = remainingVariants.flatMap((v) =>
      v.questions.map((q, idx) => ({
        ...q,
        module_id: module.id,
        display_order: idx + 1,
      }))
    );

    setModules((prev) => {
      const next = [...prev];
      const mod = { ...next[moduleIndex] };
      mod.variants = remainingVariants;
      next[moduleIndex] = mod;
      return next;
    });

    try {
      await onboardingModuleService.saveAdminQuiz(allQuestions, true, [module.id]);
      showMessage(`Variant ${variant.variant} deleted successfully`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete variant");
    }
  };

  const deleteQuestion = async (moduleIndex: number, variantIndex: number, questionIndex: number) => {
    const question = modules[moduleIndex].variants[variantIndex].questions[questionIndex];
    if (!question.id) {
      setModules((prev) => {
        const next = [...prev];
        const module = { ...next[moduleIndex] };
        const variants = module.variants.map((v, vi) => {
          if (vi !== variantIndex) return v;
          return { ...v, questions: v.questions.filter((_, qi) => qi !== questionIndex) };
        });
        module.variants = variants;
        next[moduleIndex] = module;
        return next;
      });
      return;
    }

    if (!confirm("Delete this question permanently?")) return;

    try {
      await onboardingModuleService.deleteAdminQuizQuestion(question.id);
      setModules((prev) => {
        const next = [...prev];
        const module = { ...next[moduleIndex] };
        const variants = module.variants.map((v, vi) => {
          if (vi !== variantIndex) return v;
          return { ...v, questions: v.questions.filter((_, qi) => qi !== questionIndex) };
        });
        module.variants = variants;
        next[moduleIndex] = module;
        return next;
      });
      showMessage("Question deleted successfully");
    } catch (err) {
      const message = err instanceof AxiosError ? err.response?.data?.detail || "Failed to delete question" : "Failed to delete question";
      setError(message);
    }
  };

  const saveQuestion = async (moduleIndex: number, variantIndex: number, questionIndex: number) => {
    const module = modules[moduleIndex];
    const question = module.variants[variantIndex].questions[questionIndex];

    if (!question.question_text.trim()) {
      setError("Question text is required");
      return;
    }

    updateQuestion(moduleIndex, variantIndex, questionIndex, { saving: true });

    try {
      const payload = {
        module_id: module.id,
        question_text: question.question_text,
        question_type: question.question_type,
        choices: question.choices,
        correct_answer: question.correct_answer,
        variant: question.variant,
        priority: question.priority,
      };

      let savedQuestion: any;
      if (question.id) {
        savedQuestion = await onboardingModuleService.updateAdminQuizQuestion(question.id, payload);
      } else {
        savedQuestion = await onboardingModuleService.createAdminQuizQuestion(payload);
      }

      updateQuestion(moduleIndex, variantIndex, questionIndex, { id: savedQuestion.id, saving: false });
      showMessage("Question saved successfully");
    } catch (err) {
      const message = err instanceof AxiosError ? err.response?.data?.detail || "Failed to save question" : "Failed to save question";
      setError(message);
      updateQuestion(moduleIndex, variantIndex, questionIndex, { saving: false });
    }
  };

  const getModuleQuestionCount = (module: ModuleForm) =>
    module.variants.reduce((variantTotal, variant) => variantTotal + variant.questions.length, 0);

  return (
    <div className="admin-onboarding-quiz" style={{ padding: 32 }}>
      <div className="candidate-container" style={{ maxWidth: 1200 }}>
        <div style={{ marginBottom: 24 }}>
          <h1>Onboarding Quiz Management</h1>
          <p className="subtitle">
            Manage quiz questions for all modules. Expand a module to view and edit its variants and questions.
          </p>
        </div>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Snackbar
          open={snackOpen}
          autoHideDuration={4000}
          onClose={() => setSnackOpen(false)}
          anchorOrigin={{ vertical: "top", horizontal: "right" }}
        >
          <Alert onClose={() => setSnackOpen(false)} severity="success" sx={{ width: "100%" }}>
            {success}
          </Alert>
        </Snackbar>

        <Backdrop
          sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.drawer + 1 }}
          open={loading}
        >
          <CircularProgress color="inherit" />
        </Backdrop>

        {modules.length === 0 && !loading && (
          <Alert severity="info">No modules found.</Alert>
        )}

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {modules.map((module, moduleIndex) => (
            <Card key={module.id} sx={{ border: "1px solid #e2e8f0" }}>
              <CardContent>
                <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap", mb: 1 }}>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ flex: 1 }}>
                    {module.rank}. {module.title}
                  </Typography>
                  <Button
                    variant="text"
                    size="small"
                    onClick={() => updateModule(moduleIndex, { expanded: !module.expanded })}
                    startIcon={module.expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    sx={{ textTransform: "none", fontWeight: 600 }}
                  >
                    {module.expanded ? "Hide" : "View"} Questions ({getModuleQuestionCount(module)})
                  </Button>
                </Box>

                <Collapse in={module.expanded}>
                  <Divider sx={{ my: 2 }} />
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                    <Typography variant="subtitle1" fontWeight={700}>
                      Variants
                    </Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => addVariant(moduleIndex)}
                      sx={{ textTransform: "none", fontWeight: 600 }}
                    >
                      Add Variant
                    </Button>
                  </Box>

                  <Tabs
                    value={module.variants.map((v) => v.variant)}
                    onChange={(_, value) => {
                      const idx = module.variants.findIndex((v) => v.variant === value);
                      if (idx >= 0) {
                        updateModule(moduleIndex, {
                          expanded: true,
                          variants: module.variants.map((v, i) => ({
                            ...v,
                            active: i === idx,
                          })),
                        });
                      }
                    }}
                    sx={{ mb: 2 }}
                  >
                    {module.variants.map((variant) => (
                      <Tab
                        key={variant.variant}
                        label={`Variant ${variant.variant}`}
                        value={variant.variant}
                      />
                    ))}
                  </Tabs>

                  {module.variants
                    .filter((v) => module.variants.find((mv) => mv.variant === v.variant && mv.active))
                    .map((variant) => {
                      const actualVariantIndex = module.variants.findIndex((v) => v.variant === variant.variant);
                      return (
                        <Card key={variant.variant} variant="outlined" sx={{ border: "1px solid #e2e8f0", backgroundColor: "#fafbfc" }}>
                          <CardContent>
                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                              <Typography variant="subtitle1" fontWeight={700}>
                                Variant {variant.variant}
                              </Typography>
                              <Box sx={{ display: "flex", gap: 1 }}>
                                <Button
                                  variant="outlined"
                                  size="small"
                                  startIcon={<AddIcon />}
                                  onClick={() => addQuestion(moduleIndex, actualVariantIndex)}
                                  sx={{ textTransform: "none", fontWeight: 600 }}
                                >
                                  Add Question
                                </Button>
                                {module.variants.length > 1 && (
                                  <IconButton
                                    color="error"
                                    onClick={() => deleteVariant(moduleIndex, actualVariantIndex)}
                                    size="small"
                                  >
                                    <DeleteIcon />
                                  </IconButton>
                                )}
                              </Box>
                            </Box>

                            {variant.questions.length === 0 && (
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                No questions yet. Click "Add Question" to create one.
                              </Typography>
                            )}

                            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                              {variant.questions.map((question, questionIndex) => (
                                <Card key={question.id ?? `new-q-${questionIndex}`} variant="outlined" sx={{ border: "1px solid #e2e8f0", backgroundColor: "#fff" }}>
                                  <CardContent>
                                    <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", flexWrap: "wrap", mb: 2 }}>
                                      <Typography sx={{ minWidth: 32, fontWeight: 700, fontSize: '0.875rem' }}>
                                        Q{questionIndex + 1}.
                                      </Typography>
                                      <FormControl size="small" sx={{ minWidth: 120 }}>
                                        <InputLabel>Type</InputLabel>
                                        <Select
                                          value={question.question_type}
                                          label="Type"
                                          onChange={(e) => updateQuestion(moduleIndex, actualVariantIndex, questionIndex, { question_type: e.target.value })}
                                          disabled={question.saving}
                                        >
                                          <MenuItem value="MCQ">MCQ</MenuItem>
                                          <MenuItem value="SCENARIO">Scenario</MenuItem>
                                        </Select>
                                      </FormControl>
                                      <TextField
                                        label="Question Text"
                                        size="small"
                                        value={question.question_text}
                                        onChange={(e) => updateQuestion(moduleIndex, actualVariantIndex, questionIndex, { question_text: e.target.value })}
                                        sx={{ flex: 1, minWidth: 200 }}
                                        disabled={question.saving}
                                      />
                                      <TextField
                                        label="Priority"
                                        type="number"
                                        size="small"
                                        value={question.priority}
                                        onChange={(e) => updateQuestion(moduleIndex, actualVariantIndex, questionIndex, { priority: parseInt(e.target.value) || 0 })}
                                        sx={{ width: 80 }}
                                        disabled={question.saving}
                                      />
                                      <Button
                                        variant="outlined"
                                        size="small"
                                        onClick={() => saveQuestion(moduleIndex, actualVariantIndex, questionIndex)}
                                        disabled={question.saving}
                                        sx={{ textTransform: "none", fontWeight: 600 }}
                                      >
                                        {question.saving ? "Saving..." : "Save"}
                                      </Button>
                                      <IconButton
                                        color="error"
                                        onClick={() => deleteQuestion(moduleIndex, actualVariantIndex, questionIndex)}
                                        size="small"
                                      >
                                        <DeleteIcon />
                                      </IconButton>
                                    </Box>

                                  {(question.question_type === "MCQ" || !question.question_type) && (
                                    <Box sx={{ mb: 2 }}>
                                      <Typography variant="subtitle2" sx={{ mb: 1 }}>Options</Typography>
                                      {question.choices.map((choice, choiceIndex) => (
                                        <Box key={choiceIndex} sx={{ display: "flex", gap: 1, mb: 1, alignItems: "center" }}>
                                          <Typography sx={{ minWidth: 24, fontWeight: 600 }}>
                                            {String.fromCharCode(65 + choiceIndex)}.
                                          </Typography>
                                          <TextField
                                            size="small"
                                            value={choice}
                                            onChange={(e) => {
                                              const newChoices = [...question.choices];
                                              newChoices[choiceIndex] = e.target.value;
                                                updateQuestion(moduleIndex, actualVariantIndex, questionIndex, { choices: newChoices });
                                            }}
                                            disabled={question.saving}
                                            sx={{ flex: 1 }}
                                          />
                                        </Box>
                                      ))}
                                    </Box>
                                  )}

                                  <TextField
                                    label="Correct Answer"
                                    size="small"
                                    value={question.correct_answer}
                                    onChange={(e) => updateQuestion(moduleIndex, actualVariantIndex, questionIndex, { correct_answer: e.target.value })}
                                    sx={{ width: "100%" }}
                                    disabled={question.saving}
                                  />
                                </CardContent>
                              </Card>
                            ))}
                          </Box>
                        </CardContent>
                      </Card>
                    );
                  })}
                </Collapse>
              </CardContent>
            </Card>
          ))}
        </Box>
      </div>
    </div>
  );
};

export default AdminOnboardingQuizUpload;
