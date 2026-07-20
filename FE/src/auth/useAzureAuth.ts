import { useContext } from "react";
import { AuthContext } from "./AuthContext";

export const useAzureAuth = () => useContext(AuthContext);
