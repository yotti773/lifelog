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
import { runSync } from "./sync/syncEngine";
import { workerSheetsTransport } from "./sync/workerSheetsTransport";

export default function App() {
  const location = useLocation();
  // 記録フロー画面はヘッダー(戻る)+下部固定ボタンの全画面レイアウトのため、ナビを出さない(モックの画面構成参照)
  const isRecordFlow = location.pathname.startsWith("/record/");

  // アプリ起動時にオンラインであれば未同期分の同期を試みる(画面設計書7章「トリガー」参照)。
  // 失敗は静かに無視する(未同期フラグは維持されるので設定画面から手動再試行できる)。
  useEffect(() => {
    void runSync({ transport: workerSheetsTransport });
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
