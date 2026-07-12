import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate, useSearchParams } from "react-router-dom";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Card from "@mui/material/Card";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import RecordHeader from "@/components/RecordHeader";
import RecordSaveFooter from "@/components/RecordSaveFooter";
import { IconClose, IconPlus, IconTrash } from "@/components/icons";
import { getAllExerciseMasterItems } from "@/db/exerciseMaster";
import { bodyPartLabel } from "@/lib/exerciseBodyParts";
import {
  getPreviousWorkoutsByExercise,
  getWorkoutRecordsForDate,
  groupWorkoutRecordsByExercise,
  replaceWorkoutRecordsForDate,
  type PreviousWorkout,
} from "@/db/workoutRecords";
import { formatMonthDay, todayDateString } from "@/lib/date";
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
  const [searchParams] = useSearchParams();
  const today = todayDateString();
  // 履歴確認画面から ?date=YYYY-MM-DD 付きで遷移してきた場合、その日付の記録を開く(Issue #73)
  const dateParam = searchParams.get("date");
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;
  const isToday = date === today;
  // 過去日を開いたときだけ、戻り先を履歴タブ(筋トレ)にする(体重記録画面と同じ考え方)
  const backToHistory = () =>
    isToday ? navigate("/") : navigate("/trends", { state: { viewMode: "history", historyKind: "strength" } });

  const [isLoading, setLoading] = useState(true);
  const [exercises, setExercises] = useState<DraftExercise[]>([]);
  const [error, setError] = useState<string | null>(null);
  // 種目名の入力候補(種目マスタ。画面設計書7.1章)
  const masterItems = useLiveQuery(() => getAllExerciseMasterItems(), []);
  // 種目名を選んだときに参照表示する「前回の重量×回数」(編集中の日より前の最新記録。Issue #100)
  const previousByName = useLiveQuery(() => getPreviousWorkoutsByExercise(date), [date]);

  // その日の記録をドラフトとして読み込む(新規/編集で画面を分けない。画面設計書7章)
  useEffect(() => {
    let cancelled = false;
    void getWorkoutRecordsForDate(date).then((records) => {
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
  }, [date]);

  const updateExercise = (index: number, patch: Partial<DraftExercise>) => {
    setError(null);
    setExercises((prev) => prev.map((exercise, i) => (i === index ? { ...exercise, ...patch } : exercise)));
  };

  // 「前回」の内容を現在の種目のセット欄へ転記する(Issue #100)。既存のセット入力は上書きする
  const applyPrevious = (exerciseIndex: number, previous: PreviousWorkout) => {
    updateExercise(exerciseIndex, {
      sets: previous.sets.map((set) => ({ weight: String(set.weightKg), reps: String(set.reps) })),
    });
  };

  const updateSet = (exerciseIndex: number, setIndex: number, patch: Partial<DraftSet>) => {
    setError(null);
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
    const drafts = exercises.map((exercise) => ({
      name: exercise.name.trim(),
      sets: exercise.sets.filter((set) => set.weight !== "" || set.reps !== ""),
    }));
    // 1セット=1レコードのデータモデルではセット0件の種目を保存できず、そのまま進めると無言で消えてしまう。
    // 名前だけ入力された種目はエラーにして保存をブロックする(画面設計書7章)
    const nameOnly = drafts.find((exercise) => exercise.name !== "" && exercise.sets.length === 0);
    if (nameOnly) {
      setError(`「${nameOnly.name}」にセットが入力されていません。種目ごと取り消す場合はごみ箱ボタンで削除してください`);
      return;
    }
    const cleaned = drafts
      .filter((exercise) => exercise.sets.length > 0)
      .map((exercise) => ({
        name: exercise.name,
        sets: exercise.sets.map((set) => ({ weightKg: Number(set.weight) || 0, reps: Number(set.reps) || 0 })),
      }));
    await replaceWorkoutRecordsForDate(date, cleaned);
    backToHistory();
  };

  // マスタに同名が重複していてもAutocompleteのキー(=文字列オプション)が衝突しないよう一意化する
  const nameOptions = useMemo(() => [...new Set((masterItems ?? []).map((item) => item.name))], [masterItems]);
  // サジェストに部位分類を補助表示するための種目名→部位のマップ(Issue #104)
  const bodyPartByName = useMemo(
    () => new Map((masterItems ?? []).filter((item) => item.bodyPart).map((item) => [item.name, item.bodyPart!])),
    [masterItems],
  );

  if (isLoading || masterItems === undefined) {
    return <Typography sx={{ p: 3, textAlign: "center", fontSize: 14, color: "text.secondary" }}>読み込み中...</Typography>;
  }

  return (
    <Box sx={{ mx: "auto", maxWidth: 448, px: "20px", pt: "16px", pb: "110px" }}>
      <RecordHeader title={isToday ? "筋トレを記録" : `${formatMonthDay(date)}の筋トレを記録`} onBack={backToHistory} />

      {exercises.map((exercise, exerciseIndex) => {
        const previous = previousByName?.get(exercise.name.trim());
        return (
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
              options={nameOptions}
              inputValue={exercise.name}
              onInputChange={(_, value) => updateExercise(exerciseIndex, { name: value })}
              renderOption={({ key, ...optionProps }, option) => {
                const bodyPart = bodyPartByName.get(option);
                return (
                  <li key={key} {...optionProps}>
                    <Typography component="span" sx={{ flex: 1, fontSize: 14 }}>
                      {option}
                    </Typography>
                    {bodyPart && (
                      <Typography component="span" sx={{ fontSize: 11, color: "text.secondary", ml: "8px", flexShrink: 0 }}>
                        {bodyPartLabel(bodyPart)}
                      </Typography>
                    )}
                  </li>
                );
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="例: ベンチプレス"
                  sx={{ "& .MuiInputBase-input": { fontFamily: fontRounded, fontWeight: 700, fontSize: 14 } }}
                />
              )}
            />
            <IconButton
              onClick={() => {
                setError(null);
                setExercises((prev) => prev.filter((_, i) => i !== exerciseIndex));
              }}
              aria-label={`種目${exerciseIndex + 1}を削除`}
              sx={{ width: 30, height: 30, borderRadius: "9px", bgcolor: tokens.beigeSoft, color: tokens.faint, flexShrink: 0 }}
            >
              <IconTrash size={14} />
            </IconButton>
          </Box>

          {/* 前回の記録(種目名が過去の記録と一致したときに参照表示。Issue #100) */}
          {previous && previous.sets.length > 0 && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                bgcolor: tokens.beigeSoft,
                borderRadius: "12px",
                p: "8px 10px 8px 12px",
                mb: "12px",
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: "text.secondary", mb: "1px" }}>
                  前回 {formatMonthDay(previous.date)}
                </Typography>
                <Typography
                  sx={{
                    fontFamily: fontRounded,
                    fontWeight: 700,
                    fontSize: 12,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {previous.sets.map((set) => `${set.weightKg}kg×${set.reps}`).join("・")}
                </Typography>
              </Box>
              <ButtonBase
                onClick={() => applyPrevious(exerciseIndex, previous)}
                sx={{
                  flexShrink: 0,
                  height: 30,
                  px: "12px",
                  borderRadius: "9px",
                  bgcolor: "background.paper",
                  border: `1px solid ${tokens.border}`,
                  color: "primary.main",
                }}
              >
                <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 12 }}>入力</Typography>
              </ButtonBase>
            </Box>
          )}

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
        );
      })}

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

      {error && <Typography sx={{ mt: "12px", fontSize: 13, color: "primary.main" }}>{error}</Typography>}

      <RecordSaveFooter onClick={handleSave} />
    </Box>
  );
}
