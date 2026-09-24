import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Workspace from "@/pages/Workspace";
import Login from "@/pages/Login";
import { ImageLightboxHost } from "@/components/ImageLightbox";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/workspace" element={<Workspace />} />
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/workspace" replace />} />
      </Routes>
      {/* 全局图片灯箱：全站唯一实例。任何组件调 useImageZoom() 即可打开 */}
      <ImageLightboxHost />
    </Router>
  );
}
