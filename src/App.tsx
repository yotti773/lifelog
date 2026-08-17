import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import Box from "@mui/material/Box";
import BottomNav from "./components/BottomNav";
import HomePage from "./pages/home/HomePage";
import TrendsPage from "./pages/trends/TrendsPage";
import SettingsPage from "./pages/settings/SettingsPage";
import FoodMasterPage from "./pages/settings/FoodMasterPage";
import ExerciseMasterPage from "./pages/settings/ExerciseMasterPage";
import HabitMasterPage from "./pages/settings/HabitMasterPage";
import WeightRecordPage from "./pages/WeightRecordPage";
import MealRecordPage from "./pages/meal/MealRecordPage";
import WaterRecordPage from "./pages/WaterRecordPage";
import DiaryRecordPage from "./pages/DiaryRecordPage";
import StrengthRecordPage from "./pages/StrengthRecordPage";
import BloodPressureRecordPage from "./pages/BloodPressureRecordPage";
import BodyMeasurementRecordPage from "./pages/BodyMeasurementRecordPage";
import { createAutoSyncRunner } from "./sync/autoSync";
import InitialSetupPage from "./pages/InitialSetupPage";
import OAuthCallbackPage from "./pages/OAuthCallbackPage";

export default function App() {
  const location = useLocation();
  // 記録フロー画面はヘッダー(戻る)+下部固定ボタンの全画面レイアウトのため、ナビを出さない(モックの画面構成参照)。
  // 初回セットアップ(Issue #217)も同じ全画面フロー — ナビを出すと目標未設定のまま他タブへ素通りできてしまう
  // Googleの認可コールバック(Issue #214)もナビを出さない — 交換中の一瞬しか表示されない中継画面で、
  // ここから他タブへ移られると認可コードが未交換のまま失われる
  const isFullScreenFlow =
    location.pathname.startsWith("/record/") ||
    location.pathname === "/setup" ||
    location.pathname === "/oauth/callback";

  // 自動同期のトリガー(画面設計書10章、Issue #105): 起動時に加え、PWAをホーム画面から開き直した
  // ときの復帰(visibilitychange)とオフライン→オンライン復帰(online)でも未同期分の同期を試みる。
  // 短時間の連続発火はcreateAutoSyncRunnerが抑止する。失敗は静かに無視する
  // (未同期フラグは維持されるので設定画面から手動再試行できる)。
  useEffect(() => {
    const autoSync = createAutoSyncRunner();
    void autoSync.trigger();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void autoSync.trigger();
      }
    };
    const handleOnline = () => {
      void autoSync.trigger({ bypassInterval: true });
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "background.default" }}>
      <Routes>
        <Route path="/setup" element={<InitialSetupPage />} />
        <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
        <Route path="/" element={<HomePage />} />
        <Route path="/trends" element={<TrendsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/settings/food-master" element={<FoodMasterPage />} />
        <Route path="/settings/exercise-master" element={<ExerciseMasterPage />} />
        <Route path="/settings/habit-master" element={<HabitMasterPage />} />
        <Route path="/record/weight" element={<WeightRecordPage />} />
        <Route path="/record/meal" element={<MealRecordPage />} />
        <Route path="/record/water" element={<WaterRecordPage />} />
        <Route path="/record/diary" element={<DiaryRecordPage />} />
        <Route path="/record/strength" element={<StrengthRecordPage />} />
        <Route path="/record/blood-pressure" element={<BloodPressureRecordPage />} />
        <Route path="/record/measurement" element={<BodyMeasurementRecordPage />} />
      </Routes>

      {!isFullScreenFlow && <BottomNav />}
    </Box>
  );
}
