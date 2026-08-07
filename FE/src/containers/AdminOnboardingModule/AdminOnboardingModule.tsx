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
} from "@mui/material";
import { AxiosError } from "axios";
import { candidateService } from "../../API/services";
import type {
  BulkCandidateCreateItem,
  BulkCandidateCreateResponse,
  Candidate,
} from "../../API/services";
import "./AdminOnboardingModule.scss";

const AdminOnboardingModule = () => {
  const [emailsInput, setEmailsInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkCandidateCreateResponse | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  const fetchOnboardingCandidates = async () => {
    setLoadingCandidates(true);
    try {
      const data = await candidateService.listCandidates(0, 100, "", "onboarding");
      setCandidates(data);
    } catch (err) {
      if (err instanceof AxiosError) {
        console.error("Failed to load onboarding candidates", err.response?.data);
      }
    } finally {
      setLoadingCandidates(false);
    }
  };

  useEffect(() => {
    fetchOnboardingCandidates();
  }, []);

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
        <h1>Onboarding Module - Bulk Add Candidates</h1>
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
              rows={4}
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
                          <TableCell>Password</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {result.created.map((item: BulkCandidateCreateItem) => (
                          <TableRow key={item.candidate_id || item.email}>
                            <TableCell>{item.email}</TableCell>
                            <TableCell>{item.candidate_id}</TableCell>
                            <TableCell>
                              <Box
                                component="span"
                                sx={{
                                  fontFamily: "monospace",
                                  backgroundColor: "#f1f5f9",
                                  px: 1,
                                  py: 0.5,
                                  borderRadius: 1,
                                  fontSize: "0.8rem",
                                }}
                              >
                                {item.password}
                              </Box>
                            </TableCell>
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
            <Typography component="h2" className="onboarding-candidates__title">
              Onboarding Candidates
            </Typography>

            {loadingCandidates ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress size={32} />
              </Box>
            ) : candidates.length === 0 ? (
              <Typography sx={{ color: "#94a3b8", py: 3, textAlign: "center" }}>
                No onboarding candidates have been added yet.
              </Typography>
            ) : (
              <Paper elevation={0} className="onboarding-candidates__table-wrapper">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Email</TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell>Candidate ID</TableCell>
                      <TableCell>Experience Level</TableCell>
                      <TableCell>Created At</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {candidates.map((candidate: Candidate) => (
                      <TableRow key={candidate.candidate_id}>
                        <TableCell>{candidate.email}</TableCell>
                        <TableCell>{candidate.full_name}</TableCell>
                        <TableCell>{candidate.candidate_id}</TableCell>
                        <TableCell>{candidate.experience_level}</TableCell>
                        <TableCell>
                          {new Date(candidate.created_at).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminOnboardingModule;
