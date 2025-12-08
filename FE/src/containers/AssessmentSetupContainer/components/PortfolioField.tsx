interface Props {
  value: string;
  setValue: (val: string) => void;
}

const PortfolioField: React.FC<Props> = ({ value, setValue }) => {
  return (
    <div className="form-field">
      <label>Client Portfolio (Optional)</label>
      <input
        type="text"
        value={value}
        placeholder="Portfolio URL"
        onChange={(e) => setValue(e.target.value)}
      />
    </div>
  );
};

export default PortfolioField;
