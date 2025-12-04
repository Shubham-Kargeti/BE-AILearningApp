import Sidebar from "../../components/Sidebar/Sidebar";
import "./AppLandingContainer.scss";
import { Outlet } from "react-router-dom";

const AppLandingContainer = () => {
  return (
    <div className="sidebar-layout">
      <div className="topics-sidebar">
        <Sidebar />
      </div>

      <div className="main-content">
        <Outlet />
      </div>
    </div>
  );
};

export default AppLandingContainer;
