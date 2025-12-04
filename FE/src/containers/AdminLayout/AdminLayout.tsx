import AdminSidebar from "./components/AdminSidebar";
import AdminNavbar from "./components/AdminNavbar";
import { Outlet } from "react-router-dom";
import "./AdminLayout.scss";

const AdminLayout = () => {
  return (
    <div className="admin-layout">

      {/* FIXED SIDEBAR */}
      <aside className="admin-sidebar-fixed">
        <AdminSidebar />
      </aside>

      {/* MAIN RIGHT SECTION */}
      <div className="admin-content">
        <AdminNavbar />

        {/* ONLY THIS SCROLLS */}
        <div className="admin-page">
          <Outlet />
        </div>
      </div>

    </div>
  );
};

export default AdminLayout;
