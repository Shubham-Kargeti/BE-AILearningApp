import React, { useState, useEffect } from "react";
import {
  Box,
  Card,
  CardContent,
  Chip,
  Typography,
  Alert,
  TextField,
  CircularProgress,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  TableContainer,
  Button,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from "@mui/material";
import { AxiosError } from "axios";
import RefreshIcon from "@mui/icons-material/Refresh";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { candidateService } from "../../API/services";
import { onboardingModuleService } from "../../API/onboarding_module.service";
import type {
  BulkCandidateCreateItem,
  BulkCandidateCreateResponse,
  Candidate,
  EmployeeModuleProgressSummaryItem,
  OnboardingCandidateStatusResponse,
} from "../../API/services";
import "./AdminOnboardingModule.scss";

const AdminOnboardingModule = () => {
  const [emailsInput, setEmailsInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkCandidateCreateResponse | null>(null);
  const [candidates, setCandidates] = useState<OnboardingCandidateStatusResponse[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [moduleProgress, setModuleProgress] = useState<EmployeeModuleProgressSummaryItem[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "completed" | "in_progress" | "not_started">("all");
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  const [emailSentId, setEmailSentId] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSearch, setEmailSearch] = useState("");
  const [progressDialogOpen, setProgressDialogOpen] = useState(false);
  const [dialogCandidate, setDialogCandidate] = useState<OnboardingCandidateStatusResponse | null>(null);
  const [dialogModuleProgress, setDialogModuleProgress] = useState<EmployeeModuleProgressSummaryItem[]>([]);
  const [loadingDialogProgress, setLoadingDialogProgress] = useState(false);

  const fetchOnboardingCandidates = async (skipCache = false) => {
    setLoadingCandidates(true);
    setRefreshError(null);
    try {
      const data = await candidateService.getOnboardingCandidatesStatus(skipCache);
      setCandidates(data);
    } catch (err) {
      if (err instanceof AxiosError) {
        console.error("Failed to load onboarding candidates", err.response?.data);
        setRefreshError(err.response?.data?.detail || "Failed to load onboarding candidates");
      } else {
        console.error("Failed to load onboarding candidates", err);
        setRefreshError("Failed to load onboarding candidates");
      }
    } finally {
      setLoadingCandidates(false);
    }
  };

  useEffect(() => {
    fetchOnboardingCandidates();
  }, []);

  const fetchModuleProgress = async (candidateId: string) => {
    setLoadingProgress(true);
    setSelectedCandidateId(candidateId);
    setRefreshError(null);
    try {
      const data = await onboardingModuleService.getEmployeeProgressSummary(candidateId);
      setModuleProgress(data.modules);
    } catch (err) {
      if (err instanceof AxiosError) {
        console.error("Failed to load module progress", err.response?.data);
        setRefreshError(err.response?.data?.detail || "Failed to load module progress");
      } else {
        console.error("Failed to load module progress", err);
        setRefreshError("Failed to load module progress");
      }
      setModuleProgress([]);
    } finally {
      setLoadingProgress(false);
    }
  };

  const getModuleStatusLabel = (status: string): string => {
    switch (status) {
      case "COMPLETED":
        return "Completed";
      case "VIDEO_IN_PROGRESS":
        return "In Progress";
      case "VIDEO_COMPLETED":
        return "In Progress";
      case "QUIZ_IN_PROGRESS":
        return "In Progress";
      case "NOT_STARTED":
        return "Not Started";
      case "LOCKED":
        return "Not Started";
      default:
        return status;
    }
  };

  const getModuleStatusColor = (status: string): "success" | "warning" | "default" => {
    switch (status) {
      case "COMPLETED":
        return "success";
      case "VIDEO_IN_PROGRESS":
      case "VIDEO_COMPLETED":
      case "QUIZ_IN_PROGRESS":
        return "warning";
      default:
        return "default";
    }
  };

  const selectedCandidate = candidates.find((c) => c.candidate_id === selectedCandidateId);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshError(null);
    try {
      await Promise.all([
        fetchOnboardingCandidates(true),
        selectedCandidateId ? fetchModuleProgress(selectedCandidateId) : Promise.resolve(),
      ]);
    } catch (err) {
      console.error("Refresh failed", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSendEmail = async (candidateId: string, email: string) => {
    setSendingEmailId(candidateId);
    setEmailError(null);
    try {
      const result = await candidateService.sendCandidateCredentialsEmail(candidateId);
      if (result?.mailto_url) {
        window.location.href = result.mailto_url;
      }
      setEmailSentId(candidateId);
      setTimeout(() => setEmailSentId(null), 3000);
    } catch (err) {
      setEmailError(err instanceof AxiosError ? (err.response?.data?.detail || "Failed to prepare email") : "Failed to prepare email");
      setTimeout(() => setEmailError(null), 5000);
    } finally {
      setSendingEmailId(null);
    }
  };

  const openProgressDialog = async (candidate: OnboardingCandidateStatusResponse) => {
    setDialogCandidate(candidate);
    setProgressDialogOpen(true);
    setLoadingDialogProgress(true);
    setRefreshError(null);

    try {
      const data = await onboardingModuleService.getEmployeeProgressSummary(candidate.candidate_id);
      setDialogModuleProgress(data.modules);
    } catch (err) {
      if (err instanceof AxiosError) {
        console.error("Failed to load module progress dialog", err.response?.data);
        setRefreshError(err.response?.data?.detail || "Failed to load module progress");
      } else {
        console.error("Failed to load module progress dialog", err);
        setRefreshError("Failed to load module progress");
      }
      setDialogModuleProgress([]);
    } finally {
      setLoadingDialogProgress(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailsInput.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const emails = emailsInput
        .split(",")
        .map((e) => e.trim())
        .filter((e) => e.length > 0);

      if (emails.length === 0) {
        setError("Please enter at least one email address.");
        return;
      }

      const response = await candidateService.createBulkCandidates(emails);
      setResult(response);
      await fetchOnboardingCandidates();
    } catch (err) {
      if (err instanceof AxiosError) {
        setError(
          err.response?.data?.detail ||
            "Failed to create candidates. Please try again."
        );
      } else {
        setError("Failed to create candidates. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasResults = result && (result.created.length > 0 || result.skipped.length > 0 || result.errors.length > 0);

  return (
    <div className="admin-onboarding-module">
      <div className="candidate-container">
        <h1>Onboarding Module - Add Candidates</h1>
        <p className="subtitle">
          Paste comma separated email addresses to create candidate accounts in
          bulk. Each candidate receives a random password and is assigned the
          junior role by default.
        </p>

        <form onSubmit={handleSubmit} className="candidate-form">
          <div className="form-group">
            <label htmlFor="emails">Email Addresses *</label>
            <TextField
              id="emails"
              name="emails"
              label="Comma separated emails"
              placeholder="john@example.com, jane@example.com, ..."
              value={emailsInput}
              onChange={(e) => setEmailsInput(e.target.value)}
              required
              fullWidth
              multiline
              rows={2}
              disabled={isSubmitting}
              variant="outlined"
            />
          </div>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <button
            type="submit"
            className="submit-btn"
            disabled={isSubmitting || !emailsInput.trim()}
          >
            {isSubmitting ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                <CircularProgress size={16} />
                Creating...
              </span>
            ) : (
              "Create Candidates"
            )}
          </button>
        </form>

        {hasResults && result && (
          <Card className="onboarding-result-card">
            <CardContent>
              <Typography component="h2" className="onboarding-result__title">
                Results
              </Typography>

              <Box className="onboarding-result__summary">
                <Chip
                  label={`Created: ${result.created.length}`}
                  color="success"
                  size="small"
                />
                <Chip
                  label={`Skipped: ${result.skipped.length}`}
                  color="warning"
                  size="small"
                />
                <Chip
                  label={`Errors: ${result.errors.length}`}
                  color={result.errors.length > 0 ? "error" : "default"}
                  size="small"
                />
              </Box>

              {result.errors.length > 0 && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {result.errors.length} email address(es) were invalid and could
                  not be created.
                </Alert>
              )}

              {result.created.length > 0 && (
                <Box className="onboarding-result__section">
                  <Typography className="onboarding-result__section-title">
                    Created Candidates ({result.created.length})
                  </Typography>
                  <Paper elevation={0} className="onboarding-result__table-wrapper">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Email</TableCell>
                          <TableCell>Candidate ID</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {result.created.map((item: BulkCandidateCreateItem) => (
                          <TableRow key={item.candidate_id || item.email}>
                            <TableCell>{item.email}</TableCell>
                            <TableCell>{item.candidate_id}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Paper>
                </Box>
              )}

              {result.skipped.length > 0 && (
                <Box className="onboarding-result__section">
                  <Typography className="onboarding-result__section-title">
                    Skipped (already exist) ({result.skipped.length})
                  </Typography>
                  <ul className="onboarding-result__list">
                    {result.skipped.map((email) => (
                      <li key={email}>{email}</li>
                    ))}
                  </ul>
                </Box>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="onboarding-candidates-card">
          <CardContent>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
              <Typography component="h2" className="onboarding-candidates__title">
                Onboarding Candidates
              </Typography>
              <Button
                type="button"
                size="small"
                variant="outlined"
                startIcon={<RefreshIcon className={isRefreshing ? "spin" : ""} />}
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                Refresh
              </Button>
            </Box>

            <Tabs
              value={activeTab}
              onChange={(_, newValue) => {
                setActiveTab(newValue);
                setSelectedCandidateId(null);
                setEmailSearch("");
              }}
              sx={{ mb: 2 }}
            >
              <Tab label={`Not Started (${candidates.filter((c) => c.overall_status === "not_started").length})`} value="not_started" />
              <Tab label={`In Progress (${candidates.filter((c) => c.overall_status === "in_progress").length})`} value="in_progress" />
              <Tab label={`Completed (${candidates.filter((c) => c.overall_status === "completed").length})`} value="completed" />
              <Tab label={`All (${candidates.length})`} value="all" />
            </Tabs>

            <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
              <TextField
                size="small"
                label="Search Email"
                value={emailSearch}
                onChange={(e) => setEmailSearch(e.target.value)}
                sx={{ minWidth: 260 }}
              />
            </Box>

            {refreshError && (
              <Alert severity="error" sx={{ mt: 2 }} onClose={() => setRefreshError(null)}>
                {refreshError}
              </Alert>
            )}

            {emailError && (
              <Alert severity="error" sx={{ mt: 1 }} onClose={() => setEmailError(null)}>
                {emailError}
              </Alert>
            )}

            {loadingCandidates ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress size={32} />
              </Box>
            ) : (() => {
              const filteredByStatus = activeTab === "all"
                ? candidates
                : candidates.filter((c) => c.overall_status === activeTab);

              const filtered = filteredByStatus.filter((candidate) =>
                candidate.email.toLowerCase().includes(emailSearch.trim().toLowerCase())
              );

              if (filtered.length === 0) {
                return (
                  <Typography sx={{ color: "#94a3b8", py: 3, textAlign: "center" }}>
                    {emailSearch.trim()
                      ? "No candidates match the current email search."
                      : "No onboarding candidates have been added yet."}
                  </Typography>
                );
              }
              return (
                <Paper elevation={0} className="onboarding-candidates__table-wrapper">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Email</TableCell>
                        <TableCell>Name</TableCell>
                        <TableCell>Created At</TableCell>
                        <TableCell align="center">Email Sent</TableCell>
                        <TableCell align="center">View</TableCell>
                        {activeTab === "not_started" && <TableCell align="center">Send Manual Email</TableCell>}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filtered.map((candidate) => {
                        const isSelected = candidate.candidate_id === selectedCandidateId;
                        return (
                          <TableRow
                            key={candidate.candidate_id}
                            hover
                            selected={isSelected}
                            onClick={() => fetchModuleProgress(candidate.candidate_id)}
                            sx={{
                              cursor: "pointer",
                              "&.Mui-selected": {
                                backgroundColor: "#eef2ff !important",
                                "&:hover": {
                                  backgroundColor: "#e0e7ff !important",
                                },
                              },
                            }}
                          >
                            <TableCell>
                              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                {isSelected && (
                                  <Box
                                    component="span"
                                    sx={{
                                      display: "inline-flex",
                                      color: "#4f46e5",
                                      fontSize: "1.1rem",
                                      lineHeight: 1,
                                    }}
                                  >
                                    ▸
                                  </Box>
                                )}
                                {candidate.email}
                              </Box>
                            </TableCell>
                            <TableCell>{candidate.full_name}</TableCell>
                            <TableCell>
                              {new Date(candidate.created_at).toLocaleString()}
                            </TableCell>
                            <TableCell align="center">
                              <Chip
                                label={candidate.onboarding_email_sent ? "Sent" : "Not Sent"}
                                color={candidate.onboarding_email_sent ? "success" : "default"}
                                size="small"
                              />
                            </TableCell>
                            <TableCell align="center">
                              <IconButton
                                aria-label={`View ${candidate.full_name} progress`}
                                color="primary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void openProgressDialog(candidate);
                                }}
                              >
                                <VisibilityIcon />
                              </IconButton>
                            </TableCell>
                            {activeTab === "not_started" && (
                              <TableCell align="center">
                                <IconButton
                                  aria-label={`Send manual email to ${candidate.full_name}`}
                                  color="primary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSendEmail(candidate.candidate_id, candidate.email);
                                  }}
                                  disabled={sendingEmailId === candidate.candidate_id}
                                >
                                  <MailOutlineIcon />
                                </IconButton>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Paper>
              );
            })()}

            <Dialog open={progressDialogOpen} onClose={() => setProgressDialogOpen(false)} maxWidth="md" fullWidth>
              <DialogTitle>
                Module Progress - {dialogCandidate?.full_name || "Candidate"} ({dialogCandidate?.email || ""})
              </DialogTitle>
              <DialogContent dividers>
                {loadingDialogProgress ? (
                  <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
                    <CircularProgress size={28} />
                  </Box>
                ) : dialogModuleProgress.length === 0 ? (
                  <Typography sx={{ color: "#94a3b8", py: 2, textAlign: "center" }}>
                    No module progress data available.
                  </Typography>
                ) : (
                  <TableContainer component={Paper} elevation={0}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Rank</TableCell>
                          <TableCell>Module</TableCell>
                          <TableCell align="center">Status</TableCell>
                          <TableCell align="center">Score</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {dialogModuleProgress.map((module: EmployeeModuleProgressSummaryItem) => {
                          const statusLabel = getModuleStatusLabel(module.status);
                          const statusColor = getModuleStatusColor(module.status);
                          const isCompleted = module.status === "COMPLETED";
                          return (
                            <TableRow key={module.module_id}>
                              <TableCell>{module.rank}</TableCell>
                              <TableCell>{module.title}</TableCell>
                              <TableCell align="center">
                                <Chip
                                  label={statusLabel}
                                  color={statusColor}
                                  size="small"
                                />
                              </TableCell>
                              <TableCell align="center">
                                {isCompleted && module.score !== null && module.score !== undefined ? (
                                  <Box component="span" sx={{ fontWeight: 600 }}>
                                    {Math.round(module.score)}%
                                    {module.passing_status && (
                                      <Chip
                                        label={module.passing_status}
                                        color={module.passing_status === "PASS" ? "success" : "error"}
                                        size="small"
                                        sx={{ ml: 1, fontSize: "0.7rem", height: 20 }}
                                      />
                                    )}
                                  </Box>
                                ) : (
                                  <Typography component="span" sx={{ color: "#94a3b8", fontSize: "0.85rem" }}>
                                    -
                                  </Typography>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setProgressDialogOpen(false)}>Close</Button>
              </DialogActions>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminOnboardingModule;
