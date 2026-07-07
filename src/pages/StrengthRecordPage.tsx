import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Card from "@mui/material/Card";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import RecordHeader from "@/components/RecordHeader";
import { IconClose, IconPlus, IconTrash } from "@/components/icons";
import { getAllExerciseMasterItems } from "@/db/exerciseMaster";
import {
  getWorkoutRecordsForDate,
  groupWorkoutRecordsByExercise,
  replaceWorkoutRecordsForDate,
} from "@/db/workoutRecords";
import { todayDateString } from "@/lib/date";
import { fontRounded, tokens } from "@/theme";

/** 入力途中の値を文字列のまま保持するドラフト(空欄は保存時に除外する) */
interface DraftSet {
  weight: string;
  reps: string;
}

interface DraftExercise {
  name: string;
  sets: DraftSet[];
}

const EMPTY_SET: DraftSet = { weight: "", reps: "" };
const emptyExercise = (): DraftExercise => ({ name: "", sets: [{ ...EMPTY_SET }] });

export default function StrengthRecordPage() {
  const navigate = useNavigate();
  const today = todayDateString();

  const [isLoading, setLoading] = useState(true);
  const [exercises, setExercises] = useState<DraftExercise[]>([]);
  // 種目名の入力候補(種目マスタ。画面設計書7.1章)
  const masterItems = useLiveQuery(() => getAllExerciseMasterItems(), []);

  // 当日分の記録をドラフトとして読み込む(新規/編集で画面を分けない。画面設計書7章)
  useEffect(() => {
    let cancelled = false;
    void getWorkoutRecordsForDate(today).then((records) => {
      if (cancelled) return;
      const grouped = groupWorkoutRecordsByExercise(records);
      setExercises(
        grouped.length > 0
          ? grouped.map((exercise) => ({
              name: exercise.name,
              sets: exercise.sets.map((set) => ({ weight: String(set.weightKg), reps: String(set.reps) })),
            }))
          : [emptyExercise()],
      );
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [today]);

  const updateExercise = (index: number, patch: Partial<DraftExercise>) => {
    setExercises((prev) => prev.map((exercise, i) => (i === index ? { ...exercise, ...patch } : exercise)));
  };

  const updateSet = (exerciseIndex: number, setIndex: number, patch: Partial<DraftSet>) => {
    setExercises((prev) =>
      prev.map((exercise, i) =>
        i === exerciseIndex
          ? { ...exercise, sets: exercise.sets.map((set, k) => (k === setIndex ? { ...set, ...patch } : set)) }
          : exercise,
      ),
    );
  };

  const handleSave = async () => {
    // 重量・回数がどちらも空のセットと、名前もセットも空の種目は除外して当日分を置き換える(画面設計書7章)
    const cleaned = exercises
      .map((exercise) => ({
        name: exercise.name.trim(),
        sets: exercise.sets.filter((set) => set.weight !== "" || set.reps !== ""),
      }))
      .filter((exercise) => exercise.name !== "" || exercise.sets.length > 0)
      .map((exercise) => ({
        name: exercise.name,
        sets: exercise.sets.map((set) => ({ weightKg: Number(set.weight) || 0, reps: Number(set.reps) || 0 })),
      }));
    await replaceWorkoutRecordsForDate(today, cleaned);
    navigate("/");
  };

  if (isLoading || masterItems === undefined) {
    return <Typography sx={{ p: 3, textAlign: "center", fontSize: 14, color: "text.secondary" }}>読み込み中...</Typography>;
  }

  return (
    <Box sx={{ mx: "auto", maxWidth: 448, px: "20px", pt: "16px", pb: "110px" }}>
      <RecordHeader title="筋トレを記録" onBack={() => navigate("/")} />

      {exercises.map((exercise, exerciseIndex) => (
        <Card key={exerciseIndex} sx={{ p: "14px", mb: "14px", borderRadius: "18px" }}>
          {/* 種目名 */}
          <Box sx={{ display: "flex", alignItems: "center", gap: "8px", mb: "12px" }}>
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: "9px",
                bgcolor: tokens.strengthBg,
                color: "primary.main",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: fontRounded,
                fontWeight: 700,
                fontSize: 12,
                flexShrink: 0,
              }}
            >
              {exerciseIndex + 1}
            </Box>
            <Autocomplete
              freeSolo
              fullWidth
              size="small"
              options={masterItems.map((item) => item.name)}
              inputValue={exercise.name}
              onInputChange={(_, value) => updateExercise(exerciseIndex, { name: value })}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="例: ベンチプレス"
                  sx={{ "& .MuiInputBase-input": { fontFamily: fontRounded, fontWeight: 700, fontSize: 14 } }}
                />
              )}
            />
            <IconButton
              onClick={() => setExercises((prev) => prev.filter((_, i) => i !== exerciseIndex))}
              aria-label={`種目${exerciseIndex + 1}を削除`}
              sx={{ width: 30, height: 30, borderRadius: "9px", bgcolor: tokens.beigeSoft, color: tokens.faint, flexShrink: 0 }}
            >
              <IconTrash size={14} />
            </IconButton>
          </Box>

          {/* セット */}
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: "8px" }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: "text.secondary" }}>セット</Typography>
            <Typography sx={{ fontSize: 11, fontWeight: 500, color: "text.secondary" }}>重量 × 回数</Typography>
          </Box>
          <Box sx={{ display: "flex", flexDirection: "column", gap: "8px", mb: "10px" }}>
            {exercise.sets.map((set, setIndex) => (
              <Box
                key={setIndex}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  bgcolor: "background.paper",
                  border: `1.5px solid ${tokens.border}`,
                  borderRadius: "14px",
                  p: "10px 13px",
                }}
              >
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: "8px",
                    bgcolor: tokens.beigeSoft,
                    color: "text.secondary",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: fontRounded,
                    fontWeight: 700,
                    fontSize: 11,
                    flexShrink: 0,
                  }}
                >
                  {setIndex + 1}
                </Box>
                <InputBase
                  type="number"
                  value={set.weight}
                  onChange={(e) => updateSet(exerciseIndex, setIndex, { weight: e.target.value })}
                  inputProps={{
                    "aria-label": `${setIndex + 1}セット目の重量(kg)`,
                    inputMode: "decimal",
                    style: { textAlign: "center", fontFamily: fontRounded, fontWeight: 700, fontSize: 17, padding: 0 },
                  }}
                  sx={{ flex: 1, minWidth: 0 }}
                />
                <Typography sx={{ fontSize: 12, fontWeight: 500, color: "text.secondary", flexShrink: 0 }}>kg ×</Typography>
                <InputBase
                  type="number"
                  value={set.reps}
                  onChange={(e) => updateSet(exerciseIndex, setIndex, { reps: e.target.value })}
                  inputProps={{
                    "aria-label": `${setIndex + 1}セット目の回数`,
                    inputMode: "numeric",
                    style: { textAlign: "center", fontFamily: fontRounded, fontWeight: 700, fontSize: 17, padding: 0 },
                  }}
                  sx={{ flex: 1, minWidth: 0 }}
                />
                <Typography sx={{ fontSize: 12, fontWeight: 500, color: "text.secondary", flexShrink: 0 }}>回</Typography>
                <IconButton
                  onClick={() =>
                    updateExercise(exerciseIndex, { sets: exercise.sets.filter((_, k) => k !== setIndex) })
                  }
                  aria-label={`${setIndex + 1}セット目を削除`}
                  sx={{ width: 26, height: 26, borderRadius: "8px", bgcolor: tokens.beigeSoft, color: tokens.faint, flexShrink: 0 }}
                >
                  <IconClose size={12} />
                </IconButton>
              </Box>
            ))}
          </Box>
          <ButtonBase
            onClick={() => updateExercise(exerciseIndex, { sets: [...exercise.sets, { ...EMPTY_SET }] })}
            sx={{
              width: "100%",
              height: 40,
              border: "1.5px dashed #E0B7A8",
              borderRadius: "12px",
              gap: "6px",
              color: "primary.main",
            }}
          >
            <IconPlus size={14} />
            <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 12, color: "primary.main" }}>
              セットを追加
            </Typography>
          </ButtonBase>
        </Card>
      ))}

      <ButtonBase
        onClick={() => setExercises((prev) => [...prev, emptyExercise()])}
        sx={{
          width: "100%",
          height: 48,
          border: "1.5px dashed #E0B7A8",
          borderRadius: "14px",
          gap: "7px",
          color: "primary.main",
          mb: "6px",
        }}
      >
        <IconPlus size={16} />
        <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 13, color: "primary.main" }}>
          種目を追加
        </Typography>
      </ButtonBase>

      {/* 下部固定の保存ボタン */}
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
        <Box sx={{ mx: "auto", maxWidth: 408 }}>
          <Button
            fullWidth
            variant="contained"
            onClick={handleSave}
            sx={{ height: 54, borderRadius: "16px", fontSize: 16, boxShadow: tokens.primaryButtonShadow }}
          >
            保存する
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
