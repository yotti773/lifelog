import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import Box from "@mui/material/Box";
import BottomNav from "./components/BottomNav";
import HomePage from "./pages/home/HomePage";
import TrendsPage from "./pages/trends/TrendsPage";
import SettingsPage from "./pages/settings/SettingsPage";
import FoodMasterPage from "./pages/settings/FoodMasterPage";
import ExerciseMasterPage from "./pages/settings/ExerciseMasterPage";
import WeightRecordPage from "./pages/WeightRecordPage";
import MealRecordPage from "./pages/meal/MealRecordPage";
import WaterRecordPage from "./pages/WaterRecordPage";
import DiaryRecordPage from "./pages/DiaryRecordPage";
import StrengthRecordPage from "./pages/StrengthRecordPage";
import { createAutoSyncRunner } from "./sync/autoSync";

export default function App() {
  const location = useLocation();
  // 記録フロー画面はヘッダー(戻る)+下部固定ボタンの全画面レイアウトのため、ナビを出さない(モックの画面構成参照)
  const isRecordFlow = location.pathname.startsWith("/record/");

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
        <Route path="/" element={<HomePage />} />
        <Route path="/trends" element={<TrendsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/settings/food-master" element={<FoodMasterPage />} />
        <Route path="/settings/exercise-master" element={<ExerciseMasterPage />} />
        <Route path="/record/weight" element={<WeightRecordPage />} />
        <Route path="/record/meal" element={<MealRecordPage />} />
        <Route path="/record/water" element={<WaterRecordPage />} />
        <Route path="/record/diary" element={<DiaryRecordPage />} />
        <Route path="/record/strength" element={<StrengthRecordPage />} />
      </Routes>

      {!isRecordFlow && <BottomNav />}
    </Box>
  );
}
