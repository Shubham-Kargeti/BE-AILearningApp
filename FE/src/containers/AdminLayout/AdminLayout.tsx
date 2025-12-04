import AdminSidebar from "./components/AdminSidebar";
import AdminNavbar from "./components/AdminNavbar";
import { Outlet } from "react-router-dom";
import "./AdminLayout.scss";

const AdminLayout = () => {
  return (
    <div className="admin-layout">
      <AdminSidebar />

      <div className="admin-content">
        <AdminNavbar />

        <div className="admin-page">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;
