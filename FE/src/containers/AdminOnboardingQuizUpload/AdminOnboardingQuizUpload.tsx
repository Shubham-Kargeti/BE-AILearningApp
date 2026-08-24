import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Tab,
  Tabs,
  Typography,
  Snackbar,
  Backdrop,
} from "@mui/material";
import axios from "axios";
import apiClient from "../../API/services";

type QuizQuestionPreview = {
  module_no: number;
  module_id: number;
  question_text: string;
  question_type: string;
  choices: string[];
  correct_answer: string;
  variant: string;
};

type ModuleVariantPreview = {
  variant: string;
  questions: QuizQuestionPreview[];
};

type ModulePreview = {
  module_no: number;
  module_id: number;
  title: string;
  variants: ModuleVariantPreview[];
};

const AdminOnboardingQuizUpload = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [modules, setModules] = useState<ModulePreview[]>([]);
  const [selectedModuleNo, setSelectedModuleNo] = useState<number | null>(null);
  const [activeVariant, setActiveVariant] = useState<string>("1");
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isExistingData, setIsExistingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [snackOpen, setSnackOpen] = useState(false);

  useEffect(() => {
    if (!modules.length) {
      setSelectedModuleNo(null);
      setActiveVariant("1");
      return;
    }

    const firstModule = modules[0];
    if (selectedModuleNo === null || !modules.some((m) => m.module_no === selectedModuleNo)) {
      setSelectedModuleNo(firstModule.module_no);
      setActiveVariant(firstModule.variants[0]?.variant || "1");
    }
  }, [modules, selectedModuleNo]);

  const activeModule = useMemo(
    () => modules.find((module) => module.module_no === selectedModuleNo) ?? modules[0] ?? null,
    [modules, selectedModuleNo]
  );

  const activeVariantQuestions = useMemo(() => {
    if (!activeModule) return [];
    const variant = activeModule.variants.find((item) => item.variant === activeVariant);
    return variant?.questions ?? [];
  }, [activeModule, activeVariant]);

  const variantTabOptions = activeModule?.variants.map((item) => item.variant) ?? [];

  const loadCurrentModules = async () => {
    try {
      const response = await apiClient.get<{ modules: ModulePreview[] }>(
        "/onboarding-modules/admin/onboarding-module-quiz-current"
      );
      setModules(response.data.modules);
      setIsExistingData(true);
      setReviewConfirmed(false);
      if (response.data.modules.length > 0) {
        setSelectedModuleNo(response.data.modules[0].module_no);
        setActiveVariant(response.data.modules[0].variants[0]?.variant || "1");
      }
    } catch (err) {
      setModules([]);
      setIsExistingData(false);
    }
  };

  useEffect(() => {
    loadCurrentModules();
  }, []);

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Please choose an Excel file first.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await apiClient.post<{ modules: ModulePreview[] }>(
        "/onboarding-modules/admin/onboarding-module-quiz-preview",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      setModules(response.data.modules);
      setIsExistingData(false);
      setReviewConfirmed(false);
      if (response.data.modules.length > 0) {
        setSelectedModuleNo(response.data.modules[0].module_no);
        setActiveVariant(response.data.modules[0].variants[0]?.variant || "1");
      }
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.detail || "Failed to parse the uploaded Excel file"
        : "Failed to parse the uploaded Excel file";
      setError(message);
      setModules([]);
    } finally {
      setLoading(false);
    }
  };

  const totalQuestions = modules.reduce(
    (count, module) =>
      count + module.variants.reduce((variantTotal, variant) => variantTotal + variant.questions.length, 0),
    0
  );

  const saveConfirmedQuestions = async () => {
    if (!modules.length) {
      setError("Upload a file first to save questions.");
      return;
    }

    if (!reviewConfirmed) {
      setError("Please confirm that you have reviewed all uploaded questions before saving.");
      return;
    }

    const toSave = modules.flatMap((module) =>
      module.variants.flatMap((variant) =>
        variant.questions.map((question) => ({
          ...question,
          module_id: module.module_id,
          module_no: module.module_no,
          variant: variant.variant,
        }))
      )
    );

    if (!toSave.length) {
      setError("No questions were found in the uploaded file.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await apiClient.post<{ saved: number; modules: number[] }>(
        "/onboarding-modules/admin/onboarding-module-quiz-save",
        { questions: toSave }
      );
      setSuccess(`Saved ${response.data.saved} questions across ${response.data.modules.length} module(s).`);
      setReviewConfirmed(false);
      // After a successful save, switch back to view mode by loading the
      // currently saved quiz data and mark it as existing so the Save
      // checkbox/button are hidden until a new file is uploaded.
      setIsExistingData(true);
      setSelectedFile(null);
      await loadCurrentModules();
      setSnackOpen(true);
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.detail || "Failed to save questions"
        : "Failed to save questions";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-onboarding-module" style={{ padding: 32 }}>
      <div className="candidate-container" style={{ maxWidth: 1200 }}>
        <h1>Onboarding Quiz Upload</h1>
        <p className="subtitle">
          Upload the Excel workbook, review all module questions by variant, and confirm once you have checked everything before saving to the database.
        </p>

        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 24, flexWrap: "wrap" }}>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
          />
          <Button variant="contained" onClick={handleUpload} disabled={!selectedFile || loading}>
            {loading ? "Parsing..." : "Upload Excel"}
          </Button>
        </div>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
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
          open={loading || saving}
        >
          <CircularProgress color="inherit" />
        </Backdrop>

        {modules.length > 0 && (
          <>
            {isExistingData && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Current saved questionnaire is loaded. Upload a new Excel file to review and replace it.
              </Alert>
            )}

            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, mb: 2, flexWrap: "wrap" }}>
              <Tabs
                value={selectedModuleNo ?? 0}
                onChange={(_, value) => {
                  setSelectedModuleNo(value);
                  const module = modules.find((item) => item.module_no === value);
                  setActiveVariant(module?.variants[0]?.variant || "1");
                }}
                variant="scrollable"
                scrollButtons="auto"
              >
                {modules.map((module) => (
                  <Tab key={module.module_no} label={`${module.module_no}. ${module.title}`} value={module.module_no} />
                ))}
              </Tabs>
            </Box>

            {activeModule && (
              <>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="h6">Module: {activeModule.title}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total questions in upload: {totalQuestions}
                  </Typography>
                </Box>

                <Tabs
                  value={activeVariant}
                  onChange={(_, value) => setActiveVariant(value)}
                  sx={{ mb: 2 }}
                >
                  {variantTabOptions.map((variant) => (
                    <Tab key={variant} label={`Variant ${variant}`} value={variant} />
                  ))}
                </Tabs>

                <Card>
                  <CardContent>
                    {activeVariantQuestions.length === 0 ? (
                      <Typography>No questions found for this variant.</Typography>
                    ) : (
                      activeVariantQuestions.map((question, index) => {
                        return (
                          <Box
                            key={`${question.question_text}-${index}`}
                            sx={{ border: "1px solid #e2e8f0", borderRadius: 2, p: 2, mb: 2 }}
                          >
                            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                              Q{index + 1}. {question.question_text}
                            </Typography>

                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                              Type: {question.question_type} | Variant: {question.variant}
                            </Typography>

                            {question.choices && question.choices.length > 0 && (
                              <Box sx={{ ml: 2, mb: 1 }}>
                                {question.choices.map((choice, choiceIndex) => (
                                  <Typography key={`${choice}-${choiceIndex}`} variant="body2">
                                    {String.fromCharCode(65 + choiceIndex)}. {choice}
                                  </Typography>
                                ))}
                              </Box>
                            )}

                            <Typography variant="body2">
                              Correct answer: <strong>{question.correct_answer || "—"}</strong>
                            </Typography>
                          </Box>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              </>
            )}

            {!isExistingData && (
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  gap: 2,
                  mt: 3,
                  flexWrap: "wrap",
                  borderTop: "1px solid #e2e8f0",
                  pt: 3,
                }}
              >
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={reviewConfirmed}
                      onChange={(event) => setReviewConfirmed(event.target.checked)}
                    />
                  }
                  label="I have reviewed all uploaded questions across all modules and am ready to save them."
                />

                <Button
                  variant="contained"
                  color="success"
                  onClick={saveConfirmedQuestions}
                  disabled={saving || !reviewConfirmed}
                >
                  {saving ? <CircularProgress size={18} color="inherit" sx={{ mr: 1 }} /> : null}
                  Save All Questions
                </Button>
              </Box>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminOnboardingQuizUpload;
