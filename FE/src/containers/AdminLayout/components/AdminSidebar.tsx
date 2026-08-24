import { useState } from "react";
import { NavLink } from "react-router-dom";
import "./AdminSidebar.scss";

const AdminSidebar = () => {
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(true);

  return (
    <div className="admin-sidebar">
      <div className="admin-logo">Admin Panel</div>

      <nav className="admin-nav">
        <NavLink to="/admin/dashboard" className="admin-link">
          Dashboard
        </NavLink>

        <NavLink to="/admin/assessment" className="admin-link">
          Assessment Creation
        </NavLink>

        <NavLink to="/admin/add-candidate" className="admin-link">
          Add Candidate
        </NavLink>

        <NavLink to="/admin/candidate-list" className="admin-link">
          Candidate List
        </NavLink>

        {/* <NavLink to="/admin/requirement" className="admin-link">
          Requirement Creation
        </NavLink> */}

        <div className="admin-menu-group">
          <button
            type="button"
            className="admin-menu-label"
            aria-expanded={isOnboardingOpen}
            onClick={() => setIsOnboardingOpen((prev) => !prev)}
          >
            <span>Onboarding Modules</span>
            <span className="admin-menu-chevron">{isOnboardingOpen ? "−" : "+"}</span>
          </button>

          {isOnboardingOpen && (
            <div className="admin-submenu">
              <NavLink to="/admin/onboarding-module" className="admin-sub-link">
                1. Add/View Candidates
              </NavLink>
              <NavLink to="/admin/onboarding-quiz-upload" className="admin-sub-link">
                2. Add/View Questionnaire
              </NavLink>
              <NavLink to="/admin/onboarding-modules-upload" className="admin-sub-link">
                3. Add/View Modules
              </NavLink>
            </div>
          )}
        </div>

        <NavLink to="/admin/settings" className="admin-link">
          Settings
        </NavLink>
      </nav>
    </div>
  );
};

export default AdminSidebar;
