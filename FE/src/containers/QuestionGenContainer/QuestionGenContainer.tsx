import React, { useEffect, useState } from "react";
import { questionGenService } from "../../API/services";
import Toast from "../../components/Toast/Toast";
import "./QuestionGenContainer.scss";

const QuestionGenContainer: React.FC = () => {
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: string; message: string } | null>(null);
  const [topic, setTopic] = useState<string>("agentic_ai");
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);

  const fetchDrafts = async () => {
    try {
      setLoading(true);
      const data = await questionGenService.listDrafts("draft");
      setDrafts(data);
    } catch (err: any) {
      setToast({ type: "error", message: err?.response?.data?.error || "Failed to load drafts" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrafts();
  }, []);

  const handlePublish = async (id: number) => {
    try {
      await questionGenService.publishDraft(id);
      setToast({ type: "success", message: "Draft published" });
      fetchDrafts();
    } catch (err: any) {
      setToast({ type: "error", message: err?.response?.data?.error || "Publish failed" });
    }
  };

  const handleStartGeneration = async () => {
    try {
      setJobStatus("queued");
      const res = await questionGenService.startGeneration(topic, 5, 1);
      setJobId(res.task_id);
      setJobStatus("queued");
      setToast({ type: "info", message: `Generation job queued: ${res.task_id}` });

      // Poll status
      const poll = setInterval(async () => {
        try {
          const st = await questionGenService.getGenerationStatus(res.task_id);
          setJobStatus(st.status);
          if (st.status && st.status !== "PENDING" && st.status !== "STARTED" && st.status !== "QUEUED") {
            clearInterval(poll as any);
            setToast({ type: "success", message: `Job ${res.task_id} finished: ${st.status}` });
            fetchDrafts();
          }
        } catch (err: any) {
          clearInterval(poll as any);
          setToast({ type: "error", message: "Failed to fetch job status" });
        }
      }, 3000);
    } catch (err: any) {
      setToast({ type: "error", message: err?.response?.data?.error || "Start generation failed" });
    }
  };

  return (
    <div className="question-gen-container">
      <h2>Generated Question Bank</h2>
      {toast && <Toast type={toast.type as any} message={toast.message} onClose={() => setToast(null)} />}

      <div className="generation-controls">
        <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic" />
        <button onClick={handleStartGeneration}>Start Generation</button>
        {jobId && <div className="job-info">Job: {jobId} — Status: {jobStatus}</div>}
      </div>

      {loading ? (
        <p>Loading drafts...</p>
      ) : (
        <div className="draft-list">
          {drafts.length === 0 ? (
            <p>No drafts found.</p>
          ) : (
            drafts.map((d) => (
              <div key={d.id} className="draft-item">
                <div className="draft-body">
                  <div className="question-text">{d.question_text}</div>
                  {d.choices && (
                    <ul className="choices">
                      {Object.entries(d.choices).map(([k, v]: any) => (
                        <li key={k}><strong>{k}</strong>: {v}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="draft-actions">
                  <button className="publish-btn" onClick={() => handlePublish(d.id)}>Publish</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default QuestionGenContainer;
