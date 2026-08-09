import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import {
  IconBarbell,
  IconCalendar,
  IconClock,
  IconDrop,
  IconFork,
  IconPerson,
  IconRuler,
  IconSun,
} from "@/components/icons";
import { db } from "@/db/db";
import { getSettings, updateSettings } from "@/db/settings";
import { activityLevelLabel } from "@/lib/nutritionCalc";
import { tokens } from "@/theme";
import SettingRow, { SectionLabel } from "./settings/SettingRow";
import ValueEditorDrawer, { SEX_OPTIONS, type EditTarget } from "./settings/ValueEditorDrawer";
import PfcEditorDrawer from "./settings/PfcEditorDrawer";

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
  const [pfcEditorOpen, setPfcEditorOpen] = useState(false);

  const hasPfcTargets =
    settings !== undefined &&
    settings.dailyProteinTargetG !== undefined &&
    settings.dailyFatTargetG !== undefined &&
    settings.dailyCarbsTargetG !== undefined;

  useEffect(() => {
    if (
      settings !== undefined &&
      settings.heightCm !== undefined &&
      settings.birthYear !== undefined &&
      settings.sex !== undefined &&
      settings.activityLevel !== undefined &&
      settings.goalWeightKg !== undefined &&
      settings.goalDate !== undefined &&
      settings.dailyCalorieTarget !== undefined
    ) {
      navigate("/");
    }
  }, [settings, navigate]);

  const isSetupComplete =
    settings !== undefined &&
    settings.heightCm !== undefined &&
    settings.birthYear !== undefined &&
    settings.sex !== undefined &&
    settings.activityLevel !== undefined &&
    settings.goalWeightKg !== undefined &&
    settings.goalDate !== undefined &&
    settings.dailyCalorieTarget !== undefined;

  if (settings === undefined) {
    return <Typography sx={{ p: 3, textAlign: "center", fontSize: 14, color: "text.secondary" }}>読み込み中...</Typography>;
  }

  const handleEditorClose = () => {
    setEditTarget(null);
  };

  const handleSkip = async () => {
    await updateSettings({ initialSetupSkipped: true });
    navigate("/");
  };

  return (
    <Box sx={{ mx: "auto", maxWidth: 448, px: "20px", pt: "24px", pb: "130px" }}>
      <Box sx={{ mb: "28px" }}>
        <Typography sx={{ fontWeight: 600, fontSize: 18, mb: "8px" }}>
          プロフィールと目標を設定しましょう
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary", lineHeight: 1.6 }}>
          あなたの身体情報と減量目標を入力してください。後から変更できます。
        </Typography>
      </Box>

      <SectionLabel>あなたのプロフィール</SectionLabel>
      <Card sx={{ overflow: "hidden", mb: "8px" }}>
        <SettingRow
          icon={<IconRuler />}
          iconBg={tokens.secondarySoft}
          iconColor="#2EC4B6"
          label="身長"
          value={settings.heightCm !== undefined ? `${settings.heightCm} cm` : "未設定"}
          divider
          onClick={() => setEditTarget("height")}
        />
        <SettingRow
          icon={<IconCalendar />}
          iconBg={tokens.warnBg}
          iconColor={tokens.warnIcon}
          label="生年"
          value={settings.birthYear !== undefined ? `${settings.birthYear}年` : "未設定"}
          divider
          onClick={() => setEditTarget("birthYear")}
        />
        <SettingRow
          icon={<IconPerson />}
          iconBg={tokens.primarySoft}
          iconColor="#FF6B4A"
          label="性別"
          value={SEX_OPTIONS.find((o) => o.value === settings.sex)?.label ?? "未設定"}
          divider
          onClick={() => setEditTarget("sex")}
        />
        <SettingRow
          icon={<IconBarbell size={18} />}
          iconBg={tokens.strengthBg}
          iconColor="#FF6B4A"
          label="活動レベル"
          value={settings.activityLevel !== undefined ? activityLevelLabel(settings.activityLevel) : "未設定"}
          onClick={() => setEditTarget("activityLevel")}
        />
      </Card>
      <Typography sx={{ fontSize: 11, color: "text.secondary", mb: "18px", px: "4px", lineHeight: 1.6 }}>
        目標カロリーの自動計算にのみ使います。入力しないことも可能ですが、自動計算できなくなります
      </Typography>

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
          divider
          onClick={() => setEditTarget("calories")}
        />
        <SettingRow
          icon={<IconFork size={18} />}
          iconBg={tokens.secondarySoft}
          iconColor="#2EC4B6"
          label="PFC目標"
          value={
            hasPfcTargets
              ? `P${settings.dailyProteinTargetG} / F${settings.dailyFatTargetG} / C${settings.dailyCarbsTargetG} g`
              : "未設定"
          }
          divider
          onClick={() => setPfcEditorOpen(true)}
        />
        <SettingRow
          icon={<IconDrop size={18} />}
          iconBg={tokens.waterSoft}
          iconColor={tokens.waterMain}
          label="1日の目標水分摂取量"
          value={settings.dailyWaterTargetMl !== undefined ? `${settings.dailyWaterTargetMl.toLocaleString()} ml` : "未設定"}
          onClick={() => setEditTarget("waterGoal")}
        />
      </Card>

      <Box sx={{ display: "flex", flexDirection: "column", gap: "8px", mt: "28px" }}>
        <Button
          variant="contained"
          size="large"
          onClick={() => navigate("/")}
          disabled={!isSetupComplete}
        >
          はじめる
        </Button>
        <Button
          variant="outlined"
          size="large"
          onClick={handleSkip}
        >
          スキップして始める
        </Button>
      </Box>

      <ValueEditorDrawer
        target={editTarget}
        settings={settings}
        latestWeightRecord={latestWeightRecord}
        onClose={handleEditorClose}
        onCalorieTargetChanged={() => {}}
      />

      <PfcEditorDrawer
        open={pfcEditorOpen}
        withSuggestion={false}
        settings={settings}
        latestWeightRecord={latestWeightRecord}
        onClose={() => setPfcEditorOpen(false)}
      />
    </Box>
  );
}
