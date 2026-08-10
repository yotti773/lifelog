import { useState } from "react";
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
import { getSettings, isInitialSetupComplete, updateSettings } from "@/db/settings";
import { activityLevelLabel } from "@/lib/nutritionCalc";
import { fontRounded, tokens } from "@/theme";
import PfcEditorDrawer from "./settings/PfcEditorDrawer";
import SettingRow, { SectionLabel } from "./settings/SettingRow";
import ValueEditorDrawer, { SEX_OPTIONS, type EditTarget } from "./settings/ValueEditorDrawer";

/** YYYY-MM-DD を 2026/10/31 形式で表示する(設定画面と同じ表記) */
function formatSlashDate(date: string): string {
  const [y, m, d] = date.split("-");
  return `${y}/${Number(m)}/${Number(d)}`;
}

/** セクション見出しの右に添える必須/任意バッジ */
function RequirementBadge({ required }: { required?: boolean }) {
  return (
    <Box
      component="span"
      sx={{
        ml: "8px",
        fontSize: 10,
        fontWeight: 700,
        px: "7px",
        py: "2px",
        borderRadius: "999px",
        ...(required
          ? { bgcolor: tokens.primarySoft, color: "primary.dark" }
          : { bgcolor: tokens.divider, color: tokens.faint }),
      }}
    >
      {required ? "必須" : "任意"}
    </Box>
  );
}

/**
 * 初回セットアップ画面(Issue #217)。DEFAULT_SETTINGSから開発者本人の目標値を撤去したため、
 * 目標が空のまま起動したユーザーをここで受け止める。
 *
 * 設計上の要点:
 * - **必須は目標3項目だけ**(`isInitialSetupComplete`)。プロフィール・PFC・水分は任意で、
 *   未入力でも「はじめる」を押せる。判定はホームのリダイレクトと同じ関数を使う
 * - 入力UIは設定画面と同じ`SettingRow`+`ValueEditorDrawer`/`PfcEditorDrawer`をそのまま使い、
 *   同じ項目を2通りの操作で入力させない
 * - **完了しても自動遷移しない。** 離脱は「はじめる」「あとで設定する」の明示操作だけ
 *   (自動遷移すると、最後の必須項目を埋めた瞬間に任意項目へ触れないまま画面から追い出される)
 * - 下部ナビは`App.tsx`側で非表示。抜け道を「あとで設定する」に一本化する
 */
export default function InitialSetupPage() {
  const navigate = useNavigate();
  const settings = useLiveQuery(() => getSettings(), []);
  // 目標カロリーの自動計算(Issue #43)に使う。「記録なし」とロード中を区別するためnullへ正規化する
  const latestWeightRecord = useLiveQuery(
    () => db.weightRecords.orderBy("date").last().then((v) => v ?? null),
    [],
  );

  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [pfcEditorOpen, setPfcEditorOpen] = useState(false);

  if (settings === undefined) {
    return <Typography sx={{ p: 3, textAlign: "center", fontSize: 14, color: "text.secondary" }}>読み込み中...</Typography>;
  }

  const hasPfcTargets =
    settings.dailyProteinTargetG !== undefined &&
    settings.dailyFatTargetG !== undefined &&
    settings.dailyCarbsTargetG !== undefined;

  const setupComplete = isInitialSetupComplete(settings);

  const handleSkip = async () => {
    // スキップした事実を残さないと、ホームが毎回ここへ差し戻してしまう(移行ユーザーが記録を始められない)。
    // フラグの意味は「目標を入れずに先へ進んだ」なので、必須が揃っている状態では立てない
    // (ボタン自体も出していないが、フラグの意味を壊さないようここでも守る)
    if (!setupComplete) await updateSettings({ initialSetupSkipped: true });
    navigate("/", { replace: true });
  };

  return (
    <Box sx={{ mx: "auto", maxWidth: 448, px: "20px", pt: "28px", pb: "150px" }}>
      <Box sx={{ mb: "22px" }}>
        <Typography sx={{ fontSize: 12, fontWeight: 500, color: "text.secondary", mb: "3px" }}>ようこそ</Typography>
        <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 20, letterSpacing: ".01em", mb: "6px" }}>
          まず、目標を決めましょう
        </Typography>
        <Typography sx={{ fontSize: 12.5, color: "text.secondary", lineHeight: 1.65 }}>
          達成度の判定に使います。あとから変更できます。
        </Typography>
      </Box>

      <SectionLabel>
        目標
        <RequirementBadge required />
      </SectionLabel>
      <Card sx={{ overflow: "hidden", mb: "8px" }}>
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
          value={
            settings.dailyCalorieTarget !== undefined
              ? `${settings.dailyCalorieTarget.toLocaleString()} kcal`
              : "未設定"
          }
          onClick={() => setEditTarget("calories")}
        />
      </Card>
      <Typography sx={{ fontSize: 11, color: "text.secondary", mb: "18px", px: "4px", lineHeight: 1.6 }}>
        目標日までの必要ペースと、日々の達成度の判定に使います
      </Typography>

      <SectionLabel>
        あなたのプロフィール
        <RequirementBadge />
      </SectionLabel>
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
        入れておくと、目標カロリーとPFCを自動で計算できます
      </Typography>

      <SectionLabel>
        くわしい目標
        <RequirementBadge />
      </SectionLabel>
      <Card sx={{ overflow: "hidden", mb: "8px" }}>
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
          value={
            settings.dailyWaterTargetMl !== undefined
              ? `${settings.dailyWaterTargetMl.toLocaleString()} ml`
              : "未設定"
          }
          onClick={() => setEditTarget("waterGoal")}
        />
      </Card>

      {/* 記録フロー画面(RecordSaveFooter)と同じ下部固定バー。ナビが無いぶんここが唯一の出口になる */}
      <Box
        sx={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          p: "16px 20px 26px",
          background: "linear-gradient(180deg,rgba(255,248,240,0),#FFF8F0 30%)",
          zIndex: 10,
        }}
      >
        <Box sx={{ mx: "auto", maxWidth: 408, display: "flex", flexDirection: "column", gap: "6px" }}>
          <Button
            fullWidth
            variant="contained"
            disabled={!setupComplete}
            onClick={() => navigate("/", { replace: true })}
            sx={{ height: 54, borderRadius: "16px", fontSize: 16, boxShadow: tokens.primaryButtonShadow }}
          >
            はじめる
          </Button>
          {/* 必須が揃ったら「あとで」は出さない — 各項目は確定した時点で保存済みなので、
              この状態では「はじめる」と同じ動きになり、押した人に「入力が破棄されるのか」と
              思わせるだけになる。押せる出口は常にどちらか一方だけにする */}
          {!setupComplete && (
            <Button
              fullWidth
              onClick={handleSkip}
              sx={{ height: 38, fontSize: 13, fontWeight: 500, color: "text.secondary", textDecoration: "underline" }}
            >
              あとで設定する
            </Button>
          )}
        </Box>
      </Box>

      <ValueEditorDrawer
        target={editTarget}
        settings={settings}
        latestWeightRecord={latestWeightRecord}
        onClose={() => setEditTarget(null)}
        // 初回セットアップではPFCの再計算バナーを出さない(まだPFC自体が未設定のことが多く、
        // 直下の「くわしい目標」から明示的に開ける)
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
