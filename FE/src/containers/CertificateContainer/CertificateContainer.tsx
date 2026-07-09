import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from "@mui/material";
import type { AxiosError } from "axios";
import DownloadIcon from "@mui/icons-material/Download";
import PrintIcon from "@mui/icons-material/Print";
import DashboardIcon from "@mui/icons-material/Dashboard";
import html2canvas from "html2canvas";
import { onboardingModuleService } from "../../API/onboarding_module.service";
import type { CertificateDataResponse } from "../../API/onboarding_module.model";
import "./CertificateContainer.scss";

const CertificateContainer = () => {
  const { candidateId } = useParams<{ candidateId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<CertificateDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const certificateRef = useRef<HTMLDivElement | null>(null);

  const moduleId = 15;

  useEffect(() => {
    const fetchCertificate = async () => {
      if (!candidateId) return;
      try {
        const result = await onboardingModuleService.getCertificate(
          candidateId,
          moduleId
        );
        setData(result);
      } catch (err) {
        if (err instanceof AxiosError) {
          setError(err.response?.data?.detail || "Failed to load certificate");
        } else {
          setError("Failed to load certificate");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchCertificate();
  }, [candidateId, moduleId]);

  const handleDownloadPng = async () => {
    if (!certificateRef.current) return;
    try {
      const canvas = await html2canvas(certificateRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
      });
      const link = document.createElement("a");
      link.download = `certificate-${candidateId}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("Failed to download certificate", err);
    }
  };

  const handlePrintPdf = () => {
    window.print();
  };

  const handleGoToDashboard = () => {
    navigate("/app/onboarding-candidate");
  };

  if (loading) {
    return (
      <Box className="certificate-container" sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <Typography sx={{ color: "#fff" }}>Loading certificate...</Typography>
      </Box>
    );
  }

  if (error || !data) {
    return (
      <Box className="certificate-container" sx={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: "60vh", gap: 2 }}>
        <Typography variant="h5" sx={{ color: "#fff", fontWeight: 700 }}>
          {error || "Certificate not found"}
        </Typography>
        <Button variant="contained" onClick={handleGoToDashboard}>
          Go to Dashboard
        </Button>
      </Box>
    );
  }

  const passingModules = data.modules.filter((m) => m.passing_status === "PASS").length;
  const totalModules = data.modules.length;
  const overallScore =
    totalModules > 0
      ? Math.round(
          data.modules.reduce((sum, m) => sum + (m.score ?? 0), 0) / totalModules
        )
      : 0;

  return (
    <main className="certificate-container">
      <Box className="certificate-actions">
        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          onClick={handleDownloadPng}
          className="certificate-action-btn"
        >
          Download PNG
        </Button>
        <Button
          variant="contained"
          startIcon={<PrintIcon />}
          onClick={handlePrintPdf}
          className="certificate-action-btn"
        >
          Print PDF
        </Button>
        <Button
          variant="contained"
          startIcon={<DashboardIcon />}
          onClick={handleGoToDashboard}
          className="certificate-action-btn"
        >
          Go to Dashboard
        </Button>
      </Box>

      <Box className="certificate-wrapper">
        <Card className="certificate-card" ref={certificateRef}>
          <CardContent className="certificate-card__content">
            <Box className="certificate-header">
              <Typography className="certificate-header__icon" variant="h1">
                🎓
              </Typography>
              <Typography className="certificate-header__title">
                Certificate of Completion
              </Typography>
              <Typography className="certificate-header__subtitle">
                This is to certify that
              </Typography>
            </Box>

            <Box className="certificate-body">
              <Typography className="certificate-name" variant="h3">
                {data.candidate_name}
              </Typography>

              <Typography className="certificate-body__text">
                has successfully completed all onboarding modules and is hereby awarded the
                <strong> Engagement Clearance Certificate</strong>.
              </Typography>

              <Box className="certificate-stats">
                <Box className="certificate-stat">
                  <Typography className="certificate-stat__value">{totalModules}</Typography>
                  <Typography className="certificate-stat__label">Modules</Typography>
                </Box>
                <Box className="certificate-stat">
                  <Typography className="certificate-stat__value">{passingModules}</Typography>
                  <Typography className="certificate-stat__label">Passed</Typography>
                </Box>
                <Box className="certificate-stat">
                  <Typography className="certificate-stat__value">{overallScore}%</Typography>
                  <Typography className="certificate-stat__label">Avg Score</Typography>
                </Box>
              </Box>

              <TableContainer component={Paper} className="certificate-table">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Module</TableCell>
                      <TableCell>Score</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.modules.map((module) => (
                      <TableRow key={module.module_id}>
                        <TableCell>
                          <Typography fontWeight={700}>
                            {module.rank}. {module.title}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography fontWeight={700}>
                            {module.score !== null && module.score !== undefined
                              ? `${Math.round(module.score)}%`
                              : "N/A"}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={module.passing_status || module.status}
                            color={module.passing_status === "PASS" ? "success" : "default"}
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>

            <Box className="certificate-footer">
              <Typography className="certificate-date">
                {data.completed_date
                  ? new Date(data.completed_date).toLocaleDateString()
                  : new Date().toLocaleDateString()}
              </Typography>
              <Typography className="certificate-id">
                Certificate ID: CERT-{data.candidate_name?.slice(0, 3).toUpperCase()}-{candidateId}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </main>
  );
};

export default CertificateContainer;
