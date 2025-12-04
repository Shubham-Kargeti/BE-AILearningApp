import { Modal, Box, Typography, Button } from "@mui/material";
import "../QuizContainer.scss";
import { apiCall } from "../../../API";
import { START_QUIZ } from "../../../API/constants";

interface QuizInstructionsModalProps {
  open: boolean;
  onStart: () => void;
}

const QuizInstructionsModal = ({
  open,
  onStart,
}: QuizInstructionsModalProps) => {
  return (
    <Modal open={open}>
      <Box className="quiz-modal">
        <Typography variant="h5" className="modal-title">
          Before You Start
        </Typography>
        <Typography className="modal-text">
          • This is a timed quiz. Each question has a 30-second timer.
          <br />
          • Once started, the quiz will enter full screen mode.
          <br />• Copy/paste, minimize, switching tabs, or leaving fullscreen
          will auto-submit the test.
        </Typography>

        <Button variant="contained" className="start-btn" onClick={onStart}>
          Start Quiz
        </Button>
      </Box>
    </Modal>
  );
};

export default QuizInstructionsModal;
