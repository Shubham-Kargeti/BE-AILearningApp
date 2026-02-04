import { NavLink } from "react-router-dom";
import "./AdminSidebar.scss";

const AdminSidebar = () => {
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

        <NavLink to="/admin/requirement" className="admin-link">
          Requirement Creation
        </NavLink>

        <NavLink to="/admin/settings" className="admin-link">
          Settings
        </NavLink>
      </nav>
    </div>
  );
};

export default AdminSidebar;
