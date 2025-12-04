interface Props {
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
}

const AssessmentSetupSubmitButton: React.FC<Props> = ({
  disabled,
  loading,
  onClick,
}) => {
  return (
    <button
      className={`submit-btn ${disabled ? "disabled" : ""}`}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading ? "Processing..." : "Set Assessment"}
    </button>
  );
};

export default AssessmentSetupSubmitButton;
