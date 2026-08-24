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
  key_concepts: KeyConceptItem[];
};

const AdminOnboardingKeyConceptUpload = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [modules, setModules] = useState<ModulePreview[]>([]);
  const [selectedModuleNo, setSelectedModuleNo] = useState<number | null>(null);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isExistingData, setIsExistingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  const loadCurrentModules = async () => {
    try {
      const response = await apiClient.get<{ modules: ModulePreview[] }>(
        "/onboarding-modules/admin/onboarding-module-keyconcepts-current"
      );
      setModules(response.data.modules);
      setIsExistingData(true);
      setReviewConfirmed(false);
      if (response.data.modules.length > 0) {
        setSelectedModuleNo(response.data.modules[0].module_no);
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
        "/onboarding-modules/admin/onboarding-module-keyconcepts-preview",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      setModules(response.data.modules);
      setIsExistingData(false);
      setReviewConfirmed(false);
      if (response.data.modules.length > 0) {
        setSelectedModuleNo(response.data.modules[0].module_no);
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

  const totalConcepts = modules.reduce((count, module) => count + module.key_concepts.length, 0);

  const saveConfirmedConcepts = async () => {
    if (!modules.length) {
      setError("Upload a file first to save key concepts.");
      return;
    }

    if (!reviewConfirmed) {
      setError("Please confirm that you have reviewed all uploaded key concepts before saving.");
      return;
    }

    const toSave = modules.flatMap((module) =>
      module.key_concepts.map((concept) => ({
        ...concept,
        module_id: module.module_id,
        module_no: module.module_no,
      }))
    );

    if (!toSave.length) {
      setError("No key concepts were found in the uploaded file.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await apiClient.post<{ saved: number; modules: number[] }>(
        "/onboarding-modules/admin/onboarding-module-keyconcepts-save",
        { key_concepts: toSave }
      );
      setSuccess(`Saved ${response.data.saved} key concepts across ${response.data.modules.length} module(s).`);
      setReviewConfirmed(false);
    } catch (err) {
      const message = axios.isAxiosError(err) ? err.response?.data?.detail || "Failed to save key concepts" : "Failed to save key concepts";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-onboarding-module" style={{ padding: 32 }}>
      <div className="candidate-container" style={{ maxWidth: 1200 }}>
        <h1>Onboarding Key Concepts Upload</h1>
        <p className="subtitle">
          Upload the Excel workbook, review all module key concepts, and confirm once you have checked everything before saving to the database.
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

        {modules.length > 0 && (
          <>
            {isExistingData && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Current saved key concepts are loaded. Upload a new Excel file to review and replace them.
              </Alert>
            )}

            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, mb: 2, flexWrap: "wrap" }}>
              <Tabs
                value={selectedModuleNo ?? 0}
                onChange={(_, value) => {
                  setSelectedModuleNo(value);
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
                    Total key concepts in upload: {totalConcepts}
                  </Typography>
                </Box>

                <Card>
                  <CardContent>
                    {activeModule.key_concepts.length === 0 ? (
                      <Typography>No key concepts found for this module.</Typography>
                    ) : (
                      activeModule.key_concepts.map((concept, index) => {
                        return (
                          <Box
                            key={`${concept.title}-${index}`}
                            sx={{ border: "1px solid #e2e8f0", borderRadius: 2, p: 2, mb: 2 }}
                          >
                            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
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
                  label="I have reviewed all uploaded key concepts across all modules and am ready to save them."
                />

                <Button
                  variant="contained"
                  color="success"
                  onClick={saveConfirmedConcepts}
                  disabled={saving || !reviewConfirmed}
                >
                  {saving ? <CircularProgress size={18} color="inherit" sx={{ mr: 1 }} /> : null}
                  Save All Key Concepts
                </Button>
              </Box>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminOnboardingKeyConceptUpload;
