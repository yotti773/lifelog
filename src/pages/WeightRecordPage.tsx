import { useState, type SubmitEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import FieldLabel from "@/components/FieldLabel";
import RecordHeader from "@/components/RecordHeader";
import RecordNotFound from "@/components/RecordNotFound";
import RecordSaveFooter from "@/components/RecordSaveFooter";
import { IconArrow } from "@/components/icons";
import { db } from "@/db/db";
import { getWeightRecord, saveWeightRecord } from "@/db/weightRecords";
import { useDailyRecordEditor } from "@/hooks/useDailyRecordEditor";
import { formatMonthDay } from "@/lib/date";
import { fontRounded } from "@/theme";

export default function WeightRecordPage() {
  const navigate = useNavigate();
  const [weightKg, setWeightKg] = useState("");
  const [bodyFatPercent, setBodyFatPercent] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { editDate, isTodayParam, loadStatus, dateTime, setDateTime, isEditing, selectedDate, navigateAfterSave } =
    useDailyRecordEditor(getWeightRecord, (record) => {
      setWeightKg(String(record.weightKg));
      setBodyFatPercent(record.bodyFatPercent !== undefined ? String(record.bodyFatPercent) : "");
      setNote(record.note ?? "");
    });

  const previous = useLiveQuery(
    () => db.weightRecords.where("date").below(selectedDate).last(),
    [selectedDate],
  );

  const parsedWeight = Number(weightKg);
  const diff =
    previous && weightKg !== "" && !Number.isNaN(parsedWeight) ? parsedWeight - previous.weightKg : null;

  const parsedBodyFatPercent = Number(bodyFatPercent);

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (weightKg === "" || Number.isNaN(parsedWeight)) {
      setError("体重を入力してください");
      return;
    }
    if (bodyFatPercent !== "" && Number.isNaN(parsedBodyFatPercent)) {
      setError("体脂肪率は数値で入力してください");
      return;
    }
    await saveWeightRecord({
      date: selectedDate,
      weightKg: parsedWeight,
      bodyFatPercent: bodyFatPercent !== "" ? parsedBodyFatPercent : undefined,
      note: note.trim() || undefined,
      timestamp: new Date(dateTime).toISOString(),
    });
    navigateAfterSave();
  };

  if (loadStatus === "loading") {
    return <Typography sx={{ p: 3, textAlign: "center", fontSize: 14, color: "text.secondary" }}>読み込み中...</Typography>;
  }

  if (loadStatus === "not-found") {
    return <RecordNotFound recordLabel="体重記録" />;
  }

  return (
    <Box sx={{ mx: "auto", maxWidth: 448, px: "20px", pt: "16px", pb: "110px" }}>
      <RecordHeader
        title={isEditing ? "体重を編集" : !isTodayParam && editDate ? `${formatMonthDay(selectedDate)}の体重を記録` : "体重を記録"}
        onBack={() => navigate(-1)}
      />

      <Box component="form" onSubmit={handleSubmit}>
        <FieldLabel>日時</FieldLabel>
        <TextField
          fullWidth
          type="datetime-local"
          value={dateTime}
          onChange={(e) => setDateTime(e.target.value)}
          disabled={isEditing}
          helperText={isEditing ? "日時は編集できません" : undefined}
          sx={{ mb: "14px" }}
        />

        <FieldLabel>体重</FieldLabel>
        <TextField
          fullWidth
          type="number"
          value={weightKg}
          onChange={(e) => setWeightKg(e.target.value)}
          placeholder="72.0"
          slotProps={{
            htmlInput: { step: "0.1", inputMode: "decimal", style: { fontFamily: fontRounded, fontWeight: 800, fontSize: 34 } },
            input: {
              endAdornment: (
                <Typography sx={{ fontFamily: fontRounded, fontWeight: 500, fontSize: 18, color: "text.secondary", ml: "8px" }}>
                  kg
                </Typography>
              ),
            },
          }}
          sx={{ mb: "8px" }}
        />
        {diff !== null && (
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              color: diff <= 0 ? "secondary.main" : "primary.main",
              mb: "6px",
            }}
          >
            <IconArrow up={diff > 0} size={12} />
            <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 13 }}>
              前回比 {Math.abs(diff).toFixed(1)}kg
            </Typography>
          </Box>
        )}

        <FieldLabel optional>体脂肪率</FieldLabel>
        <TextField
          fullWidth
          type="number"
          value={bodyFatPercent}
          onChange={(e) => setBodyFatPercent(e.target.value)}
          placeholder="24.5"
          slotProps={{
            htmlInput: { step: "0.1", inputMode: "decimal", style: { fontFamily: fontRounded, fontWeight: 700, fontSize: 18 } },
            input: {
              endAdornment: <Typography sx={{ fontWeight: 500, color: "text.secondary" }}>%</Typography>,
            },
          }}
          sx={{ mb: "14px" }}
        />

        <FieldLabel optional>メモ</FieldLabel>
        <TextField
          fullWidth
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="筋トレ後 / 飲み会翌日 など"
        />

        {error && <Typography sx={{ mt: "12px", fontSize: 13, color: "primary.main" }}>{error}</Typography>}

        <RecordSaveFooter type="submit" />
      </Box>
    </Box>
  );
}
