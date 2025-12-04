const AssessmentMethodSelector = () => {
  return (
    <div className="form-field">
      <label>Assessment Method *</label>

      <div className="radio-group">
        <label>
          <input type="radio" checked readOnly />
          Questionnaire
        </label>

        <label title="Interview is disabled for MVP">
          <input type="radio" disabled />
          Interview (Disabled)
        </label>
      </div>
    </div>
  );
};

export default AssessmentMethodSelector;
