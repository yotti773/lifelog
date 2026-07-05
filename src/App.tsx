import { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import BottomNav from "./components/BottomNav";
import Fab from "./components/Fab";
import ActionSheet from "./components/ActionSheet";
import Home from "./pages/Home";
import Trends from "./pages/Trends";
import Settings from "./pages/Settings";
import WeightRecordPage from "./pages/WeightRecordPage";
import MealRecordPage from "./pages/MealRecordPage";
import { runSync } from "./sync/syncEngine";
import { workerSheetsTransport } from "./sync/workerSheetsTransport";

export default function App() {
  const [isActionSheetOpen, setActionSheetOpen] = useState(false);

  // アプリ起動時にオンラインであれば未同期分の同期を試みる(画面設計書7章「トリガー」参照)。
  // 失敗は静かに無視する(未同期フラグは維持されるので設定画面から手動再試行できる)。
  useEffect(() => {
    void runSync({ transport: workerSheetsTransport });
  }, []);

  return (
    <div className="min-h-dvh bg-background">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/trends" element={<Trends />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/record/weight" element={<WeightRecordPage />} />
        <Route path="/record/meal" element={<MealRecordPage />} />
      </Routes>

      <Fab onClick={() => setActionSheetOpen(true)} />
      {isActionSheetOpen && <ActionSheet onClose={() => setActionSheetOpen(false)} />}
      <BottomNav />
    </div>
  );
}
