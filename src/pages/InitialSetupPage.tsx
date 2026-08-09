import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import {
  IconCalendar,
  IconClock,
  IconSun,
} from "@/components/icons";
import { db } from "@/db/db";
import { getSettings } from "@/db/settings";
import { tokens } from "@/theme";
import SettingRow, { SectionLabel } from "./settings/SettingRow";
import ValueEditorDrawer, { type EditTarget } from "./settings/ValueEditorDrawer";

/** YYYY-MM-DD を 2026/10/31 形式で表示する */
function formatSlashDate(date: string): string {
  const [y, m, d] = date.split("-");
  return `${y}/${Number(m)}/${Number(d)}`;
}

export default function InitialSetupPage() {
  const navigate = useNavigate();
  const settings = useLiveQuery(() => getSettings(), []);
  const latestWeightRecord = useLiveQuery(
    () => db.weightRecords.orderBy("date").last().then((v) => v ?? null),
    [],
  );

  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

  useEffect(() => {
    if (settings !== undefined && settings.goalWeightKg !== undefined && settings.goalDate !== undefined && settings.dailyCalorieTarget !== undefined) {
      navigate("/");
    }
  }, [settings, navigate]);

  if (settings === undefined) {
    return <Typography sx={{ p: 3, textAlign: "center", fontSize: 14, color: "text.secondary" }}>読み込み中...</Typography>;
  }

  const handleEditorClose = () => {
    setEditTarget(null);
  };

  return (
    <Box sx={{ mx: "auto", maxWidth: 448, px: "20px", pt: "24px", pb: "80px" }}>
      <Box sx={{ mb: "28px" }}>
        <Typography sx={{ fontWeight: 600, fontSize: 18, mb: "8px" }}>
          目標を設定しましょう
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary", lineHeight: 1.6 }}>
          減量目標と日々の目標カロリーを入力してください。後から変更できます。
        </Typography>
      </Box>

      <SectionLabel>目標</SectionLabel>
      <Card sx={{ overflow: "hidden", mb: "18px" }}>
        <SettingRow
          icon={<IconClock />}
          iconBg={tokens.secondarySoft}
          iconColor="#2EC4B6"
          label="目標体重"
          value={settings.goalWeightKg !== undefined ? `${settings.goalWeightKg.toFixed(1)} kg` : "未設定"}
          divider
          onClick={() => setEditTarget("weight")}
        />
        <SettingRow
          icon={<IconCalendar />}
          iconBg={tokens.primarySoft}
          iconColor="#FF6B4A"
          label="目標日"
          value={settings.goalDate !== undefined ? formatSlashDate(settings.goalDate) : "未設定"}
          divider
          onClick={() => setEditTarget("goalDate")}
        />
        <SettingRow
          icon={<IconSun />}
          iconBg={tokens.warnBg}
          iconColor={tokens.warnIcon}
          label="1日の目標カロリー"
          value={settings.dailyCalorieTarget !== undefined ? `${settings.dailyCalorieTarget.toLocaleString()} kcal` : "未設定"}
          onClick={() => setEditTarget("calories")}
        />
      </Card>

      {settings.goalWeightKg !== undefined && settings.goalDate !== undefined && settings.dailyCalorieTarget !== undefined && (
        <Box sx={{ textAlign: "center" }}>
          <Button variant="contained" size="large" onClick={() => navigate("/")} sx={{ minWidth: 200 }}>
            はじめる
          </Button>
        </Box>
      )}

      <ValueEditorDrawer
        target={editTarget}
        settings={settings}
        latestWeightRecord={latestWeightRecord}
        onClose={handleEditorClose}
        onCalorieTargetChanged={() => {}}
      />
    </Box>
  );
}
