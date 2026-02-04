import { Modal, Box, Typography, Button } from "@mui/material";
import "../QuizContainer.scss";

interface QuizInstructionsModalProps {
  open: boolean;
  onStart: () => void;
  duration: number;      // seconds
  perQuestion: number;   // seconds
}

const QuizInstructionsModal = ({
  open,
  onStart,
  duration,
  perQuestion,
}: QuizInstructionsModalProps) => {
  const minutes = Math.floor(duration / 60);
  return (
    <Modal open={open}>
      <Box className="quiz-modal">
        <Typography variant="h5" className="modal-title">
          Before You Start
        </Typography>
        <Typography className="modal-text">
          • This is a timed quiz. Total time: <strong>{minutes} minute{minutes !== 1 ? "s" : ""}</strong>.
          <br />
          • Each question has a <strong>{perQuestion} second{perQuestion !== 1 ? "s" : ""}</strong> timer.
          <br />
          • Once started, the quiz will enter full screen mode.
          <br />• Copy/paste, minimize, switching tabs, or leaving fullscreen will auto-submit the test.
        </Typography>

        <Button variant="contained" className="start-btn" onClick={onStart}>
          Start Quiz
        </Button>
      </Box>
    </Modal>
  );
};

export default QuizInstructionsModal;
