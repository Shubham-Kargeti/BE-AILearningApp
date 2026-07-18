import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import AuthProvider from "./auth/AuthProvider";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#1976d2",
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    {/* MSAL must wrap the router so authentication is available to every route. */}
    <AuthProvider>
      <App />
    </AuthProvider>
  </ThemeProvider>
);
