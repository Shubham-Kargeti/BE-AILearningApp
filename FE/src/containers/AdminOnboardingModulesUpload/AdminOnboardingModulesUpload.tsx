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
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { AxiosError } from "axios";
import { onboardingModuleService } from "../../API/onboarding_module.service";
import type { OnboardingModuleResponse, OnboardingModuleKeyConceptResponse } from "../../API/onboarding_module.model";
import "./AdminOnboardingModulesUpload.scss";

type KeyConceptForm = {
  id?: number;
  title: string;
  description: string;
  link_url: string;
  display_order: number;
};

type ModuleForm = {
  id?: number;
  title: string;
  description: string;
  passing_criteria: string;
  icon: string;
  rank: number;
  key_concepts: KeyConceptForm[];
  expanded: boolean;
  saving: boolean;
};

const emptyKeyConcept = (): KeyConceptForm => ({
  title: "",
  description: "",
  link_url: "",
  display_order: 0,
});

const emptyModule = (rank: number): ModuleForm => ({
  title: "",
  description: "",
  passing_criteria: "80",
  icon: "",
  rank,
  key_concepts: [],
  expanded: true,
  saving: false,
});

const AdminOnboardingModulesUpload = () => {
  const [modules, setModules] = useState<ModuleForm[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [snackOpen, setSnackOpen] = useState(false);
  const [confirmAddOpen, setConfirmAddOpen] = useState(false);

  const loadModules = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await onboardingModuleService.listOnboardingModules();
      const forms: ModuleForm[] = data.map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description || "",
        passing_criteria: String(m.passing_criteria),
        icon: m.icon || "",
        rank: m.rank,
        key_concepts: [],
        expanded: false,
        saving: false,
      }));
      setModules(forms);

      const keyConceptsPromises = data.map((m) =>
        onboardingModuleService
          .getModuleKeyConcepts(m.id)
          .catch(() => [])
          .then((concepts) => {
            setModules((prev) =>
              prev.map((mod) =>
                mod.id === m.id
                  ? {
                      ...mod,
                      key_concepts: concepts.map((c) => ({
                        id: c.id,
                        title: c.title,
                        description: c.description,
                        link_url: c.link_url || "",
                        display_order: c.display_order,
                      })),
                    }
                  : mod
              )
            );
          })
      );
      await Promise.all(keyConceptsPromises);
    } catch (err) {
      setError("Failed to load modules");
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

  const updateModule = async (index: number, updates: Partial<ModuleForm>) => {
    setModules((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  const saveModule = async (index: number) => {
    const module = modules[index];
    if (!module.title.trim()) {
      setError("Module title is required");
      return;
    }

    setModules((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], saving: true };
      return next;
    });

    try {
      if (module.id) {
        await onboardingModuleService.updateAdminModule(module.id, {
          title: module.title,
          description: module.description || undefined,
          passing_criteria: parseFloat(module.passing_criteria) || 80,
          icon: module.icon || undefined,
          rank: module.rank,
        });
      } else {
        const created = await onboardingModuleService.createAdminModule({
          title: module.title,
          description: module.description || undefined,
          passing_criteria: parseFloat(module.passing_criteria) || 80,
          icon: module.icon || undefined,
          rank: module.rank,
        });
        setModules((prev) => {
          const next = [...prev];
          next[index] = { ...next[index], id: created.id };
          return next;
        });
      }
      showMessage("Module saved successfully");
    } catch (err) {
      const message = err instanceof AxiosError ? err.response?.data?.detail || "Failed to save module" : "Failed to save module";
      setError(message);
    } finally {
      setModules((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], saving: false };
        return next;
      });
    }
  };

  const addModule = () => {
    setConfirmAddOpen(true);
  };

  const confirmAddModule = () => {
    const maxRank = modules.reduce((max, m) => Math.max(max, m.rank), 0);
    setModules((prev) => [...prev, emptyModule(maxRank + 1)]);
    setConfirmAddOpen(false);
  };

  const updateKeyConcept = (moduleIndex: number, conceptIndex: number, updates: Partial<KeyConceptForm>) => {
    setModules((prev) => {
      const next = [...prev];
      const module = { ...next[moduleIndex] };
      const concepts = module.key_concepts.map((c, i) => (i === conceptIndex ? { ...c, ...updates } : c));
      module.key_concepts = concepts;
      next[moduleIndex] = module;
      return next;
    });
  };

  const saveKeyConcept = async (moduleIndex: number, conceptIndex: number) => {
    const module = modules[moduleIndex];
    const concept = module.key_concepts[conceptIndex];
    if (!concept.title.trim()) {
      setError("Key concept title is required");
      return;
    }

    setModules((prev) => {
      const next = [...prev];
      const mod = { ...next[moduleIndex] };
      const concepts = mod.key_concepts.map((c, i) => (i === conceptIndex ? { ...c, saving: true } : c));
      mod.key_concepts = concepts;
      next[moduleIndex] = mod;
      return next;
    });

    try {
      if (concept.id) {
        await onboardingModuleService.updateAdminKeyConcept(concept.id, {
          title: concept.title,
          description: concept.description || undefined,
          link_url: concept.link_url || undefined,
          display_order: concept.display_order,
        });
      } else {
        const created = await onboardingModuleService.createAdminKeyConcept({
          module_id: module.id!,
          title: concept.title,
          description: concept.description || undefined,
          link_url: concept.link_url || undefined,
          display_order: concept.display_order,
        });
        setModules((prev) => {
          const next = [...prev];
          const mod = { ...next[moduleIndex] };
          const concepts = mod.key_concepts.map((c, i) => (i === conceptIndex ? { ...c, id: created.id } : c));
          mod.key_concepts = concepts;
          next[moduleIndex] = mod;
          return next;
        });
      }
      showMessage("Key concept saved successfully");
    } catch (err) {
      const message = err instanceof AxiosError ? err.response?.data?.detail || "Failed to save key concept" : "Failed to save key concept";
      setError(message);
    } finally {
      setModules((prev) => {
        const next = [...prev];
        const mod = { ...next[moduleIndex] };
        const concepts = mod.key_concepts.map((c, i) => (i === conceptIndex ? { ...c, saving: false } : c));
        mod.key_concepts = concepts;
        next[moduleIndex] = mod;
        return next;
      });
    }
  };

  const deleteKeyConcept = async (moduleIndex: number, conceptIndex: number) => {
    const concept = modules[moduleIndex].key_concepts[conceptIndex];
    if (!concept.id) return;
    if (!confirm("Are you sure you want to delete this key concept?")) return;

    try {
      await onboardingModuleService.deleteAdminKeyConcept(concept.id);
      setModules((prev) => {
        const next = [...prev];
        const module = { ...next[moduleIndex] };
        module.key_concepts = module.key_concepts.filter((_, i) => i !== conceptIndex);
        next[moduleIndex] = module;
        return next;
      });
      showMessage("Key concept deleted successfully");
    } catch (err) {
      const message = err instanceof AxiosError ? err.response?.data?.detail || "Failed to delete key concept" : "Failed to delete key concept";
      setError(message);
    }
  };

  const addKeyConcept = (moduleIndex: number) => {
    setModules((prev) => {
      const next = [...prev];
      const module = { ...next[moduleIndex] };
      module.key_concepts = [...module.key_concepts, emptyKeyConcept()];
      next[moduleIndex] = module;
      return next;
    });
  };

  return (
    <div className="admin-onboarding-module" style={{ padding: 32 }}>
      <div className="candidate-container" style={{ maxWidth: 1200 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1>Onboarding Modules</h1>
            <p className="subtitle">
              Manage modules and their key concepts directly. Click Save to persist changes.
            </p>
          </div>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={addModule}
            sx={{
              borderRadius: '12px',
              textTransform: 'none',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            }}
          >
            Add Module
          </Button>
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
          open={loading || saving}
        >
          <CircularProgress color="inherit" />
        </Backdrop>

        <Dialog open={confirmAddOpen} onClose={() => setConfirmAddOpen(false)}>
          <DialogTitle>Add New Module</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to add a new onboarding module?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmAddOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={confirmAddModule}>Yes, Add Module</Button>
          </DialogActions>
        </Dialog>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {modules.map((module, moduleIndex) => (
            <Card key={module.id ?? `new-${moduleIndex}`} sx={{ border: "1px solid #e2e8f0" }}>
              <CardContent>
                <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <TextField
                    label="Module No."
                    type="number"
                    size="small"
                    value={module.rank}
                    onChange={(e) => updateModule(moduleIndex, { rank: parseInt(e.target.value) || 0 })}
                    sx={{ width: 100 }}
                    disabled={!!module.id}
                  />
                  <TextField
                    label="Module Title"
                    size="small"
                    value={module.title}
                    onChange={(e) => updateModule(moduleIndex, { title: e.target.value })}
                    sx={{ flex: 1, minWidth: 200 }}
                    disabled={module.saving}
                  />
                  <TextField
                    label="Passing Criteria (%)"
                    type="number"
                    size="small"
                    value={module.passing_criteria}
                    onChange={(e) => updateModule(moduleIndex, { passing_criteria: e.target.value })}
                    sx={{ width: 160 }}
                    disabled={module.saving}
                  />
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => saveModule(moduleIndex)}
                    disabled={module.saving}
                    sx={{ textTransform: "none", fontWeight: 600 }}
                  >
                    {module.saving ? "Saving..." : "Save Module"}
                  </Button>
                </Box>

                <TextField
                  label="Description"
                  size="small"
                  multiline
                  rows={2}
                  value={module.description}
                  onChange={(e) => updateModule(moduleIndex, { description: e.target.value })}
                  sx={{ mt: 2, width: "100%" }}
                  disabled={module.saving}
                />

                <Box sx={{ mt: 2 }}>
                  <Button
                    variant="text"
                    size="small"
                    onClick={() => updateModule(moduleIndex, { expanded: !module.expanded })}
                    startIcon={module.expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    sx={{ textTransform: "none", fontWeight: 600 }}
                  >
                    {module.expanded ? "Hide" : "View"} Key Concepts ({module.key_concepts.length})
                  </Button>
                </Box>

                <Collapse in={module.expanded}>
                  <Divider sx={{ my: 2 }} />
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                    <Typography variant="subtitle1" fontWeight={700}>
                      Key Concepts
                    </Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => addKeyConcept(moduleIndex)}
                      sx={{ textTransform: "none", fontWeight: 600 }}
                    >
                      Add Key Concept
                    </Button>
                  </Box>

                  {module.key_concepts.length === 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      No key concepts yet. Click "Add Key Concept" to create one.
                    </Typography>
                  )}

                  <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {module.key_concepts.map((concept, conceptIndex) => (
                      <Card
                        key={concept.id ?? `new-concept-${conceptIndex}`}
                        variant="outlined"
                        sx={{ border: "1px solid #e2e8f0", backgroundColor: "#fafbfc" }}
                      >
                        <CardContent>
                          <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", flexWrap: "wrap" }}>
                            <TextField
                              label="Title"
                              size="small"
                              value={concept.title}
                              onChange={(e) => updateKeyConcept(moduleIndex, conceptIndex, { title: e.target.value })}
                              sx={{ flex: 1, minWidth: 200 }}
                              disabled={concept.saving}
                            />
                            <TextField
                              label="Link URL"
                              size="small"
                              value={concept.link_url}
                              onChange={(e) => updateKeyConcept(moduleIndex, conceptIndex, { link_url: e.target.value })}
                              sx={{ flex: 1, minWidth: 200 }}
                              disabled={concept.saving}
                            />
                            <Button
                              variant="outlined"
                              size="small"
                              onClick={() => saveKeyConcept(moduleIndex, conceptIndex)}
                              disabled={concept.saving}
                              sx={{ textTransform: "none", fontWeight: 600 }}
                            >
                              {concept.saving ? "Saving..." : "Save"}
                            </Button>
                            {concept.id && (
                              <IconButton
                                color="error"
                                onClick={() => deleteKeyConcept(moduleIndex, conceptIndex)}
                                size="small"
                              >
                                <DeleteIcon />
                              </IconButton>
                            )}
                          </Box>
                          <TextField
                            label="Description"
                            size="small"
                            multiline
                            rows={2}
                            value={concept.description}
                            onChange={(e) => updateKeyConcept(moduleIndex, conceptIndex, { description: e.target.value })}
                            sx={{ mt: 2, width: "100%" }}
                            disabled={concept.saving}
                          />
                        </CardContent>
                      </Card>
                    ))}
                  </Box>
                </Collapse>
              </CardContent>
            </Card>
          ))}
        </Box>
      </div>
    </div>
  );
};

export default AdminOnboardingModulesUpload;
