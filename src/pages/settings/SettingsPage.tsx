import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import {
  IconBarbell,
  IconCalendar,
  IconClock,
  IconDiary,
  IconDrop,
  IconFork,
  IconKey,
  IconPerson,
  IconRuler,
  IconSun,
} from "@/components/icons";
import { db } from "@/db/db";
import { getSettings, updateSettings } from "@/db/settings";
import { activityLevelLabel } from "@/lib/nutritionCalc";
import { fontRounded, tokens } from "@/theme";
import MasterDataSections from "./MasterDataSections";
import PfcEditorDrawer from "./PfcEditorDrawer";
import SettingRow, { SectionLabel } from "./SettingRow";
import SheetsSyncCard from "./SheetsSyncCard";
import ValueEditorDrawer, { SEX_OPTIONS, type EditTarget } from "./ValueEditorDrawer";

/** YYYY-MM-DD を 2026/10/31 形式で表示する */
function formatSlashDate(date: string): string {
  const [y, m, d] = date.split("-");
  return `${y}/${Number(m)}/${Number(d)}`;
}

export default function SettingsPage() {
  const settings = useLiveQuery(() => getSettings(), []);
  // 自動計算(Issue #43)は直近の体重記録を使う。「記録なし」とロード中を区別するためnullに正規化する
  const latestWeightRecord = useLiveQuery(
    () => db.weightRecords.orderBy("date").last().then((v) => v ?? null),
    [],
  );

  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  // PFC目標の編集シート(3項目セットのため単一値の編集シートとは別に持つ。Issue #47)
  const [pfcEditor, setPfcEditor] = useState({ open: false, withSuggestion: false });
  // 目標カロリー変更後にPFC目標の再計算を提案するバナー(自動では上書きしない。Issue #47)
  const [showPfcRecalcHint, setShowPfcRecalcHint] = useState(false);

  if (settings === undefined) {
    return <Typography sx={{ p: 3, textAlign: "center", fontSize: 14, color: "text.secondary" }}>読み込み中...</Typography>;
  }

  const openPfcEditor = (withSuggestion = false) => {
    setShowPfcRecalcHint(false);
    setPfcEditor({ open: true, withSuggestion });
  };

  const hasPfcTargets =
    settings.dailyProteinTargetG !== undefined &&
    settings.dailyFatTargetG !== undefined &&
    settings.dailyCarbsTargetG !== undefined;

  return (
    <Box sx={{ mx: "auto", maxWidth: 448, px: "20px", pt: "24px", pb: "130px" }}>
      <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 22, mb: "14px" }}>設定</Typography>

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
        目標カロリー・PFC目標の自動計算にのみ使います。未入力でも各目標値の手動入力はできます
      </Typography>

      <SectionLabel>目標</SectionLabel>
      <Card sx={{ overflow: "hidden", mb: "18px" }}>
        <SettingRow
          icon={<IconClock />}
          iconBg={tokens.secondarySoft}
          iconColor="#2EC4B6"
          label="目標体重"
          value={`${settings.goalWeightKg.toFixed(1)} kg`}
          divider
          onClick={() => setEditTarget("weight")}
        />
        <SettingRow
          icon={<IconCalendar />}
          iconBg={tokens.primarySoft}
          iconColor="#FF6B4A"
          label="目標日"
          value={formatSlashDate(settings.goalDate)}
          divider
          onClick={() => setEditTarget("goalDate")}
        />
        <SettingRow
          icon={<IconSun />}
          iconBg={tokens.warnBg}
          iconColor={tokens.warnIcon}
          label="基準日"
          value={settings.baselineDate ? formatSlashDate(settings.baselineDate) : "未設定(自動)"}
          divider
          onClick={() => setEditTarget("baseline")}
        />
        <SettingRow
          icon={<IconPerson />}
          iconBg={tokens.primarySoft}
          iconColor="#FF6B4A"
          label="1日の目標カロリー"
          value={`${settings.dailyCalorieTarget.toLocaleString()} kcal`}
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
          onClick={() => openPfcEditor()}
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
      {showPfcRecalcHint && hasPfcTargets && (
        <Box sx={{ display: "flex", alignItems: "center", gap: "10px", bgcolor: tokens.secondarySoft, borderRadius: "14px", p: "10px 14px", mt: "-8px", mb: "18px" }}>
          <Typography sx={{ flex: 1, fontSize: 11, color: tokens.secondaryDeep, lineHeight: 1.6 }}>
            目標カロリーを変更しました。PFC目標の再計算もおすすめします
          </Typography>
          <Button
            size="small"
            color="secondary"
            onClick={() => openPfcEditor(true)}
            sx={{ flexShrink: 0, fontSize: 12 }}
          >
            再計算する
          </Button>
        </Box>
      )}

      <SectionLabel>データ同期・バックアップ(スプレッドシート)</SectionLabel>
      <SheetsSyncCard lastSyncedAt={settings.lastSyncedAt} />

      <SectionLabel>API保護</SectionLabel>
      <Card sx={{ overflow: "hidden", mb: "8px" }}>
        <SettingRow
          icon={<IconKey size={18} />}
          iconBg={tokens.warnBg}
          iconColor={tokens.warnIcon}
          label="APIトークン"
          value={settings.apiToken ? "設定済み" : "未設定"}
          onClick={() => setEditTarget("apiToken")}
        />
      </Card>
      <Typography sx={{ fontSize: 11, color: "text.secondary", mb: "18px", px: "4px", lineHeight: 1.6 }}>
        同期・AI判定のAPIを第三者の呼び出しから守る合言葉です(Workerのシークレット API_AUTH_TOKEN と同じ値を設定)
      </Typography>

      <SectionLabel>AIコーチング</SectionLabel>
      <Card sx={{ overflow: "hidden", mb: "8px" }}>
        {/* 日記本文のAI送信オプトイン(Issue #103でIssue #12を決着)。デフォルトOFF */}
        <Box sx={{ display: "flex", alignItems: "center", gap: "13px", p: "9px 16px 9px 16px" }}>
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: "11px",
              bgcolor: tokens.warnBg,
              color: tokens.warnIcon,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <IconDiary size={18} />
          </Box>
          <Typography sx={{ flex: 1, fontSize: 14, fontWeight: 500 }}>日記の本文をAIに送る</Typography>
          <Switch
            checked={settings.sendDiaryTextToAi ?? false}
            onChange={(event) => void updateSettings({ sendDiaryTextToAi: event.target.checked })}
            color="secondary"
            slotProps={{ input: { "aria-label": "日記の本文をAIに送る" } }}
          />
        </Box>
      </Card>
      <Typography sx={{ fontSize: 11, color: "text.secondary", mb: "18px", px: "4px", lineHeight: 1.6 }}>
        ONにすると、週次レビューのAIコメント生成時にその週の日記本文がGoogle Gemini APIへ送信されます。OFFの間は気分タグの件数集計だけが送られます
      </Typography>

      <MasterDataSections />

      <ValueEditorDrawer
        target={editTarget}
        settings={settings}
        latestWeightRecord={latestWeightRecord}
        onClose={() => setEditTarget(null)}
        onCalorieTargetChanged={() => setShowPfcRecalcHint(true)}
      />

      <PfcEditorDrawer
        open={pfcEditor.open}
        withSuggestion={pfcEditor.withSuggestion}
        settings={settings}
        latestWeightRecord={latestWeightRecord}
        onClose={() => setPfcEditor((prev) => ({ ...prev, open: false }))}
      />
    </Box>
  );
}
