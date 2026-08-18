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
  Typography,
  Snackbar,
  Backdrop,
} from "@mui/material";
import axios from "axios";
import apiClient from "../../API/services";

type KeyConceptItem = {
  module_no: number;
  module_id: number;
  title: string;
  description: string;
  link_url?: string | null;
  display_order: number;
};

type ModulePreview = {
  module_no: number;
  module_id: number;
  title: string;
  description: string;
  passing_criteria: number;
  icon: string | null;
  key_concepts?: KeyConceptItem[];
};

const AdminOnboardingModulesUpload = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [modules, setModules] = useState<ModulePreview[]>([]);
  const [selectedModuleNo, setSelectedModuleNo] = useState<number | null>(null);
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
      return;
    }

    const firstModule = modules[0];
    if (selectedModuleNo === null || !modules.some((m) => m.module_no === selectedModuleNo)) {
      setSelectedModuleNo(firstModule.module_no);
    }
  }, [modules, selectedModuleNo]);

  const activeModule = useMemo(
    () => modules.find((module) => module.module_no === selectedModuleNo) ?? modules[0] ?? null,
    [modules, selectedModuleNo]
  );

  const loadCurrentKeyConcepts = async (): Promise<Record<number, KeyConceptItem[]>> => {
    try {
      const response = await apiClient.get<{
        modules: Array<{
          module_no: number;
          module_id: number;
          title: string;
          key_concepts: KeyConceptItem[];
        }>;
      }>("/onboarding-modules/admin/onboarding-module-keyconcepts-current");

      const map: Record<number, KeyConceptItem[]> = {};
      for (const item of response.data.modules) {
        map[item.module_no] = item.key_concepts ?? [];
      }
      return map;
    } catch (error) {
      return {};
    }
  };

  const loadCurrentModules = async () => {
    try {
      const response = await apiClient.get<{ modules: ModulePreview[] }>(
        "/onboarding-modules/admin/onboarding-modules-current"
      );
      const keyConceptsByModule = await loadCurrentKeyConcepts();
      const mergedModules = response.data.modules.map((module) => ({
        ...module,
        key_concepts: keyConceptsByModule[module.module_no] ?? [],
      }));
      setModules(mergedModules);
      setIsExistingData(true);
      setReviewConfirmed(false);
      if (mergedModules.length > 0) {
        setSelectedModuleNo(mergedModules[0].module_no);
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
        "/onboarding-modules/admin/onboarding-module-preview",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      const keyConceptsByModule = await loadCurrentKeyConcepts();
      const mergedModules = response.data.modules.map((module) => ({
        ...module,
        key_concepts: keyConceptsByModule[module.module_no] ?? [],
      }));
      setModules(mergedModules);
      setIsExistingData(false);
      setReviewConfirmed(false);
      if (mergedModules.length > 0) {
        setSelectedModuleNo(mergedModules[0].module_no);
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

  const saveConfirmedModules = async () => {
    if (!modules.length) {
      setError("Upload a file first to save modules.");
      return;
    }

    if (!reviewConfirmed) {
      setError("Please confirm that you have reviewed all uploaded module metadata before saving.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await apiClient.post<{ saved: number; modules: number[] }>(
        "/onboarding-modules/admin/onboarding-module-save",
        { modules }
      );
      setSuccess(`Saved ${response.data.saved} module records across ${response.data.modules.length} module(s).`);
      setReviewConfirmed(false);
        // After successful save switch to view mode and reload current modules
        setIsExistingData(true);
        setSelectedFile(null);
        await loadCurrentModules();
        setSnackOpen(true);
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.detail || "Failed to save modules"
        : "Failed to save modules";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-onboarding-module" style={{ padding: 32 }}>
      <div className="candidate-container" style={{ maxWidth: 1200 }}>
        <h1>Onboarding Modules Upload</h1>
        <p className="subtitle">
          Upload the Excel workbook, review each module’s metadata, and confirm before saving to the database.
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
                Current saved module metadata is loaded. Upload a new Excel file to review and replace it.
              </Alert>
            )}

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 2,
                mb: 2,
                alignItems: "stretch",
              }}
            >
              {modules.map((module) => (
                <Button
                  key={module.module_no}
                  variant={selectedModuleNo === module.module_no ? "contained" : "outlined"}
                  onClick={() => setSelectedModuleNo(module.module_no)}
                  sx={{
                    minHeight: 52,
                    textTransform: "none",
                    justifyContent: "center",
                    alignItems: "center",
                    textAlign: "center",
                    whiteSpace: "normal",
                    lineHeight: 1.3,
                    px: 1.5,
                    width: "100%",
                  }}
                >
                  {module.module_no}. {module.title}
                </Button>
              ))}
            </Box>

            {activeModule && (
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    Module {activeModule.module_no}: {activeModule.title}
                  </Typography>

                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {activeModule.description || "No description provided."}
                  </Typography>

                  <Box sx={{ display: "grid", gap: 1.5 }}>
                    <Typography><strong>Passing Criteria:</strong> {activeModule.passing_criteria}%</Typography>
                  </Box>

                  <Box sx={{ mt: 3 }}>
                    <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                      Key Concepts
                    </Typography>

                    {(activeModule.key_concepts ?? []).length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        No key concepts found for this module.
                      </Typography>
                    ) : (
                      (activeModule.key_concepts ?? []).map((concept, index) => (
                        <Box
                          key={`${concept.title}-${index}`}
                          sx={{ border: "1px solid #e2e8f0", borderRadius: 2, p: 2, mb: 2 }}
                        >
                          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                            {index + 1}. {concept.title}
                          </Typography>

                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            {concept.description}
                          </Typography>

                          {concept.link_url && (
                            <Typography variant="body2">
                              Link: <a href={concept.link_url}>{concept.link_url}</a>
                            </Typography>
                          )}
                        </Box>
                      ))
                    )}
                  </Box>
                </CardContent>
              </Card>
            )}

            {!isExistingData && (
              <Box sx={{ mt: 3, display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-start" }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={reviewConfirmed}
                      onChange={(event) => setReviewConfirmed(event.target.checked)}
                    />
                  }
                  label="I have reviewed all module metadata and want to save them."
                />

                <Button
                  variant="contained"
                  color="primary"
                  onClick={saveConfirmedModules}
                  disabled={saving || !reviewConfirmed}
                >
                  {saving ? <CircularProgress size={18} color="inherit" /> : "Save All Modules"}
                </Button>
              </Box>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminOnboardingModulesUpload;
