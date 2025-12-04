import React, { useEffect } from "react";

interface Props {
  value: string;
  setValue: (val: string) => void;
  setValid: (val: boolean) => void;
}

const EmailField: React.FC<Props> = ({ value, setValue, setValid }) => {
  useEffect(() => {
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    setValid(isValid);
  }, [value]);

  return (
    <div className="form-field">
      <label>Candidate Email *</label>
      <input
        type="email"
        value={value}
        placeholder="Enter email"
        onChange={(e) => setValue(e.target.value)}
      />
    </div>
  );
};

export default EmailField;
