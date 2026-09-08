import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import Workspace from "@/pages/Workspace";
import ImageCorrection from "@/pages/ImageCorrection";
import ColorPicker from "@/pages/ColorPicker";
import ColorConverterPage from "@/pages/ColorConverterPage";
import ColorCompare from "@/pages/ColorCompare";
import PhoneCorrection from "@/pages/PhoneCorrection";
import Knowledge from "@/pages/Knowledge";
import Community from "@/pages/Community";
import ColorLibrary from "@/pages/ColorLibrary";
import MerchantOnboarding from "@/pages/MerchantOnboarding";
import PartnerCooperation from "@/pages/PartnerCooperation";
import TrendReport from "@/pages/TrendReport";
import StartDiscussion from "@/pages/StartDiscussion";
import Login from "@/pages/Login";
import Profile from "@/pages/Profile";
import Wallet from "@/pages/Wallet";
import { useAuthStore } from "@/store/authStore";

/** 路由保护：未登录访问受保护页面时跳转到 /login */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/workspace" element={<Workspace />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <Layout>
                <Profile />
              </Layout>
            </RequireAuth>
          }
        />
        <Route
          path="/wallet"
          element={
            <RequireAuth>
              <Layout>
                <Wallet />
              </Layout>
            </RequireAuth>
          }
        />
        <Route
          path="*"
          element={
            <Layout>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/image-correction" element={<ImageCorrection />} />
                <Route path="/color-picker" element={<ColorPicker />} />
                <Route path="/color-converter" element={<ColorConverterPage />} />
                <Route path="/color-compare" element={<ColorCompare />} />
                <Route path="/phone-correction" element={<PhoneCorrection />} />
                <Route path="/knowledge" element={<Knowledge />} />
                <Route path="/community" element={<Community />} />
                <Route path="/start-discussion" element={<StartDiscussion />} />
                <Route path="/color-library" element={<ColorLibrary />} />
                <Route path="/color-library/:brandId" element={<ColorLibrary />} />
                <Route path="/color-library/:brandId/:colorId" element={<ColorLibrary />} />
                <Route path="/merchant-onboarding" element={<MerchantOnboarding />} />
                <Route path="/partner-cooperation" element={<PartnerCooperation />} />
                <Route path="/trend-report" element={<TrendReport />} />
              </Routes>
            </Layout>
          }
        />
      </Routes>
    </Router>
  );
}
