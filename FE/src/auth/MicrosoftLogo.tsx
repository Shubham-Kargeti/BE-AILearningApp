/**
 * Lightweight Microsoft mark for the sign-in button.
 * CSS-colored squares keep the icon sharp without adding another image dependency.
 */
const MicrosoftLogo = () => (
  <span className="microsoft-logo" aria-hidden="true">
    <span className="microsoft-logo__square microsoft-logo__square--red" />
    <span className="microsoft-logo__square microsoft-logo__square--green" />
    <span className="microsoft-logo__square microsoft-logo__square--blue" />
    <span className="microsoft-logo__square microsoft-logo__square--yellow" />
  </span>
);

export default MicrosoftLogo;

