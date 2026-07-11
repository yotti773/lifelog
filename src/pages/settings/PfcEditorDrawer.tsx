import { useLayoutEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Drawer from "@mui/material/Drawer";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { IconSparkle } from "@/components/icons";
import { updateSettings } from "@/db/settings";
import { suggestPfcTargets, type PfcTargetSuggestion } from "@/lib/nutritionCalc";
import { fontRounded, tokens } from "@/theme";
import type { Settings, WeightRecord } from "@/types";

interface PfcEditorDrawerProps {
  open: boolean;
  /** 開いたときに自動計算の提案を表示するか(目標カロリー変更後の「再計算する」導線) */
  withSuggestion: boolean;
  settings: Settings;
  /** 直近の体重記録(たんぱく質の提案に使用)。null=記録なし */
  latestWeightRecord: WeightRecord | null | undefined;
  onClose: () => void;
}

/** PFC目標の編集ボトムシート(3項目セット+自動計算。Issue #47) */
export default function PfcEditorDrawer({ open, withSuggestion, settings, latestWeightRecord, onClose }: PfcEditorDrawerProps) {
  const [pfcDraft, setPfcDraft] = useState({ protein: "", fat: "", carbs: "" });
  const [pfcSuggestion, setPfcSuggestion] = useState<PfcTargetSuggestion | null>(null);

  // 開くたびに現在の設定値で入力欄を初期化する(閉じている間の陳腐化した下書きを持ち越さない)。
  // クローズアニメーション中も中身を表示し続けるため、アンマウントではなくエフェクトで初期化する
  useLayoutEffect(() => {
    if (!open) return;
    setPfcDraft({
      protein: settings.dailyProteinTargetG !== undefined ? String(settings.dailyProteinTargetG) : "",
      fat: settings.dailyFatTargetG !== undefined ? String(settings.dailyFatTargetG) : "",
      carbs: settings.dailyCarbsTargetG !== undefined ? String(settings.dailyCarbsTargetG) : "",
    });
    setPfcSuggestion(
      withSuggestion && latestWeightRecord
        ? suggestPfcTargets(latestWeightRecord.weightKg, settings.dailyCalorieTarget)
        : null,
    );
  }, [open]);

  // たんぱく質の提案は直近体重を使うため、体重記録が1件も無い場合は自動計算できない(手動入力は可能。Issue #47)
  const handleAutoCalcPfc = () => {
    if (!latestWeightRecord) return;
    setPfcSuggestion(suggestPfcTargets(latestWeightRecord.weightKg, settings.dailyCalorieTarget));
  };

  // 提案値は入力欄へ転記するだけに留め、保存(確定操作)はユーザーに委ねる。転記後の手動調整も可能
  const handleAdoptPfcSuggestion = () => {
    if (!pfcSuggestion) return;
    setPfcDraft({
      protein: String(pfcSuggestion.proteinG),
      fat: String(pfcSuggestion.fatG),
      carbs: String(pfcSuggestion.carbsG),
    });
    setPfcSuggestion(null);
  };

  const pfcDraftNumbers = [pfcDraft.protein, pfcDraft.fat, pfcDraft.carbs].map(Number);
  const pfcAllEmpty = pfcDraft.protein === "" && pfcDraft.fat === "" && pfcDraft.carbs === "";
  // 3項目セットで持つ(#7の決着): 全部入力して保存するか、全部空にして未設定に戻すかのどちらか
  const canSavePfc =
    pfcAllEmpty ||
    ([pfcDraft.protein, pfcDraft.fat, pfcDraft.carbs].every((v) => v !== "") &&
      pfcDraftNumbers.every((n) => !Number.isNaN(n) && n >= 0));

  const handleSavePfc = async () => {
    if (!canSavePfc) return;
    if (pfcAllEmpty) {
      await updateSettings({
        dailyProteinTargetG: undefined,
        dailyFatTargetG: undefined,
        dailyCarbsTargetG: undefined,
      });
    } else {
      await updateSettings({
        dailyProteinTargetG: pfcDraftNumbers[0],
        dailyFatTargetG: pfcDraftNumbers[1],
        dailyCarbsTargetG: pfcDraftNumbers[2],
      });
    }
    onClose();
  };

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: { bgcolor: "background.default", borderRadius: "28px 28px 0 0", p: "12px 20px 30px", mx: "auto", maxWidth: 448, width: "100%" },
        },
      }}
    >
      <Box sx={{ width: 40, height: 5, borderRadius: "3px", bgcolor: "#E2D8C9", mx: "auto", mb: "18px" }} />
      <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 16, textAlign: "center", mb: "6px" }}>
        PFC目標
      </Typography>
      <Typography sx={{ fontSize: 11, color: "text.secondary", textAlign: "center", mb: "16px", lineHeight: 1.6 }}>
        1日のたんぱく質・脂質・炭水化物の目標量(g)
      </Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", mb: "16px" }}>
        {(
          [
            { key: "protein", label: "P たんぱく質" },
            { key: "fat", label: "F 脂質" },
            { key: "carbs", label: "C 炭水化物" },
          ] as const
        ).map(({ key, label }) => (
          <Box key={key}>
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: "text.secondary", mb: "5px", px: "2px" }}>
              {label}
            </Typography>
            <TextField
              value={pfcDraft[key]}
              onChange={(e) => setPfcDraft({ ...pfcDraft, [key]: e.target.value })}
              type="text"
              slotProps={{
                htmlInput: {
                  inputMode: "numeric",
                  style: { textAlign: "center", fontFamily: fontRounded, fontWeight: 800, fontSize: 20 },
                },
                input: {
                  endAdornment: (
                    <Typography sx={{ fontFamily: fontRounded, color: "text.secondary", fontSize: 12 }}>g</Typography>
                  ),
                },
              }}
            />
          </Box>
        ))}
      </Box>
      {pfcSuggestion === null ? (
        <>
          <Button
            fullWidth
            variant="outlined"
            color="secondary"
            onClick={handleAutoCalcPfc}
            disabled={!latestWeightRecord}
            startIcon={<IconSparkle />}
            sx={{ height: 44, borderRadius: "13px", fontSize: 13, mb: "16px" }}
          >
            体重と目標カロリーから自動計算
          </Button>
          {!latestWeightRecord && (
            <Typography sx={{ mt: "-8px", mb: "16px", fontSize: 11, color: "text.secondary", textAlign: "center" }}>
              体重を記録すると自動計算できます(手動入力は可能です)
            </Typography>
          )}
        </>
      ) : (
        <Box sx={{ bgcolor: tokens.secondarySoft, borderRadius: "16px", p: "14px 16px", mb: "16px" }}>
          <Typography sx={{ fontSize: 11, color: tokens.secondaryDeep, mb: "8px", lineHeight: 1.6 }}>
            提案: たんぱく質 = 体重×2.0g、脂質 = 目標カロリーの25%、炭水化物 = 残余
          </Typography>
          <Box sx={{ display: "flex", justifyContent: "space-around", mb: "12px" }}>
            {(
              [
                ["P", pfcSuggestion.proteinG],
                ["F", pfcSuggestion.fatG],
                ["C", pfcSuggestion.carbsG],
              ] as const
            ).map(([label, grams]) => (
              <Box key={label} sx={{ textAlign: "center" }}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: tokens.secondaryDeep }}>{label}</Typography>
                <Typography sx={{ fontFamily: fontRounded, fontWeight: 800, fontSize: 20, color: tokens.secondaryDeep }}>
                  {grams}
                  <Box component="span" sx={{ fontSize: 12, fontWeight: 500, ml: "1px" }}>
                    g
                  </Box>
                </Typography>
              </Box>
            ))}
          </Box>
          <Button
            fullWidth
            variant="contained"
            color="secondary"
            onClick={handleAdoptPfcSuggestion}
            sx={{ height: 42, borderRadius: "13px", fontSize: 13, boxShadow: tokens.secondaryButtonShadow }}
          >
            この値で入力する(調整できます)
          </Button>
        </Box>
      )}
      {!pfcAllEmpty && (
        <Button
          fullWidth
          variant="text"
          onClick={() => setPfcDraft({ protein: "", fat: "", carbs: "" })}
          sx={{ mb: "6px", color: "text.secondary" }}
        >
          未設定にする(3項目とも空にする)
        </Button>
      )}
      <Button
        fullWidth
        variant="contained"
        onClick={handleSavePfc}
        disabled={!canSavePfc}
        sx={{ height: 50, borderRadius: "14px", fontSize: 15, boxShadow: tokens.primaryButtonShadow }}
      >
        保存する
      </Button>
      <Button fullWidth variant="text" onClick={onClose} sx={{ mt: "6px", color: "text.secondary" }}>
        キャンセル
      </Button>
    </Drawer>
  );
}
