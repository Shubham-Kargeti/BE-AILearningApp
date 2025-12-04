import React, { useState } from "react";
import { FiX } from "react-icons/fi";
import "./RoleSkillPlaceholder.scss";

interface Props {
  role: string;
  setRole: (val: string) => void;
  skills: string[];
  setSkills: (val: string[]) => void;
}

const RoleSkillPlaceholder: React.FC<Props> = ({
  role,
  setRole,
  skills,
  setSkills,
}) => {

  const [tempSkill, setTempSkill] = useState("");

  const addSkill = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = tempSkill.trim();
      if (!val) return;

      setSkills([...skills, val]);
      setTempSkill("");
    }
  };

  const removeSkill = (index: number) => {
    const updated = [...skills];
    updated.splice(index, 1);
    setSkills(updated);
  };

  return (
    <div className="role-skill-wrapper">

      {/* ROLE */}
      <div className="form-group">
        <label className="form-label">Role *</label>
        <input
          type="text"
          className="form-input"
          value={role}
          placeholder="Enter candidate role"
          onChange={(e) => setRole(e.target.value)}
        />
      </div>

      {/* SKILLS */}
      <div className="form-group">
        <label className="form-label">Skills *</label>

        <input
          type="text"
          className="form-input"
          placeholder="Type skill and press Enter"
          value={tempSkill}
          onChange={(e) => setTempSkill(e.target.value)}
          onKeyDown={addSkill}
        />

        <div className="skills-list">
          {skills.map((skill, index) => (
            <span className="skill-chip" key={index}>
              {skill}
              <FiX className="remove-skill" onClick={() => removeSkill(index)} />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RoleSkillPlaceholder;
