interface Props {
  value: number;
  setValue: (val: number) => void;
}

const AvailabilitySelector: React.FC<Props> = ({ value, setValue }) => {
  return (
    <div className="form-field">
      <label>Candidate Availability: {value}%</label>
      <input
        type="range"
        min="0"
        max="100"
        step={25}     
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
      />
    </div>
  );
};

export default AvailabilitySelector;
