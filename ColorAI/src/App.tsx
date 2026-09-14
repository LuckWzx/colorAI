import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Workspace from "@/pages/Workspace";
import Login from "@/pages/Login";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/workspace" element={<Workspace />} />
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/workspace" replace />} />
      </Routes>
    </Router>
  );
}
