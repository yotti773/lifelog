import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import Box from "@mui/material/Box";
import BottomNav from "./components/BottomNav";
import Home from "./pages/Home";
import Trends from "./pages/Trends";
import Settings from "./pages/Settings";
import FoodMasterPage from "./pages/FoodMasterPage";
import WeightRecordPage from "./pages/WeightRecordPage";
import MealRecordPage from "./pages/MealRecordPage";
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
        <Route path="/" element={<Home />} />
        <Route path="/trends" element={<Trends />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/settings/food-master" element={<FoodMasterPage />} />
        <Route path="/record/weight" element={<WeightRecordPage />} />
        <Route path="/record/meal" element={<MealRecordPage />} />
      </Routes>

      {!isRecordFlow && <BottomNav />}
    </Box>
  );
}
