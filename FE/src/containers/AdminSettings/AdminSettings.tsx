import React, { useState } from "react";
import "./AdminSettings.scss";

const AdminSettings = () => {
  const [settings, setSettings] = useState({
    notificationsEmail: true,
    notificationsSms: false,
    darkMode: false,
    autoSaveInterval: "30",
  });

  const handleToggle = (key: keyof typeof settings) => {
    setSettings((prev) => ({
      ...prev,
      [key]: typeof prev[key] === "boolean" ? !prev[key] : prev[key],
    }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    alert("Settings saved successfully!");
  };

  return (
    <div className="admin-settings">
      <div className="settings-container">
        <h1>Settings</h1>
        <p className="subtitle">Manage your admin panel settings</p>

        <div className="settings-section">
          <h2>Notifications</h2>

          <div className="setting-item">
            <div className="setting-info">
              <label>Email Notifications</label>
              <p>Receive notifications via email</p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.notificationsEmail}
                onChange={() => handleToggle("notificationsEmail")}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <label>SMS Notifications</label>
              <p>Receive notifications via SMS</p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.notificationsSms}
                onChange={() => handleToggle("notificationsSms")}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>

        <div className="settings-section">
          <h2>Appearance</h2>

          <div className="setting-item">
            <div className="setting-info">
              <label>Dark Mode</label>
              <p>Enable dark theme for the admin panel</p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.darkMode}
                onChange={() => handleToggle("darkMode")}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>

        <div className="settings-section">
          <h2>General</h2>

          <div className="setting-item">
            <div className="setting-info">
              <label htmlFor="autoSave">Auto-save Interval (seconds)</label>
              <p>How often to automatically save changes</p>
            </div>
            <select
              id="autoSave"
              name="autoSaveInterval"
              value={settings.autoSaveInterval}
              onChange={handleChange}
              className="select-input"
            >
              <option value="15">Every 15 seconds</option>
              <option value="30">Every 30 seconds</option>
              <option value="60">Every 60 seconds</option>
              <option value="manual">Manual only</option>
            </select>
          </div>
        </div>

        <div className="settings-actions">
          <button className="save-btn" onClick={handleSave}>
            Save Settings
          </button>
          <button className="reset-btn" onClick={() => window.location.reload()}>
            Reset to Default
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
