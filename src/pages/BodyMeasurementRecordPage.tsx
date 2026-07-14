import { useEffect, useState, type SubmitEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import RecordHeader from "@/components/RecordHeader";
import RecordSaveFooter from "@/components/RecordSaveFooter";
import {
  deleteBodyMeasurementRecord,
  getBodyMeasurementRecord,
  saveBodyMeasurementRecord,
} from "@/db/bodyMeasurementRecords";
import { toDatetimeLocalValue, todayDateString } from "@/lib/date";
import { fontRounded, tokens } from "@/theme";

type LoadStatus = "idle" | "loading" | "loaded" | "not-found";

function FieldLabel({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <Typography sx={{ fontSize: 12, fontWeight: 700, color: "text.secondary", mb: "6px", mt: "4px" }}>
      {children}
      {optional && (
        <Box component="span" sx={{ color: tokens.faint2, fontWeight: 400 }}>
          (任意)
        </Box>
      )}
    </Typography>
  );
}

function CmField({
  label,
  optional,
  value,
  onChange,
  placeholder,
  big,
}: {
  label: string;
  optional?: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  big?: boolean;
}) {
  return (
    <Box>
      <FieldLabel optional={optional}>{label}</FieldLabel>
      <TextField
        fullWidth
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        slotProps={{
          htmlInput: {
            step: "0.1",
            inputMode: "decimal",
            style: { fontFamily: fontRounded, fontWeight: big ? 800 : 700, fontSize: big ? 34 : 18 },
          },
          input: {
            endAdornment: (
              <Typography sx={{ fontFamily: fontRounded, fontWeight: 500, fontSize: big ? 16 : 14, color: "text.secondary", ml: "6px" }}>
                cm
              </Typography>
            ),
          },
        }}
      />
    </Box>
  );
}

/**
 * 周囲径記録画面(Issue #118)。体重記録画面と同じ単一ファイル構成。
 * 腹囲を必須とし、胸囲・太ももは任意。月1回程度の低頻度入力を想定する。
 */
export default function BodyMeasurementRecordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editDate = searchParams.get("date");
  const isTodayParam = editDate === todayDateString();
  const [loadStatus, setLoadStatus] = useState<LoadStatus>(editDate ? "loading" : "idle");
  const [dateTime, setDateTime] = useState(() => toDatetimeLocalValue(new Date().toISOString()));
  const [waistCm, setWaistCm] = useState("");
  const [chestCm, setChestCm] = useState("");
  const [thighCm, setThighCm] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editDate) {
      setLoadStatus("idle");
      return;
    }
    let cancelled = false;
    setLoadStatus("loading");
    void getBodyMeasurementRecord(editDate).then((record) => {
      if (cancelled) return;
      if (!record) {
        setLoadStatus(isTodayParam ? "idle" : "not-found");
        return;
      }
      setDateTime(toDatetimeLocalValue(record.timestamp));
      setWaistCm(String(record.waistCm));
      setChestCm(record.chestCm !== undefined ? String(record.chestCm) : "");
      setThighCm(record.thighCm !== undefined ? String(record.thighCm) : "");
      setNote(record.note ?? "");
      setLoadStatus("loaded");
    });
    return () => {
      cancelled = true;
    };
  }, [editDate]);

  const isEditing = loadStatus === "loaded";
  const selectedDate = dateTime.slice(0, 10);

  const parsedWaist = Number(waistCm);
  const parsedChest = Number(chestCm);
  const parsedThigh = Number(thighCm);

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (waistCm === "" || Number.isNaN(parsedWaist)) {
      setError("おなか周りを入力してください");
      return;
    }
    if (chestCm !== "" && Number.isNaN(parsedChest)) {
      setError("胸囲は数値で入力してください");
      return;
    }
    if (thighCm !== "" && Number.isNaN(parsedThigh)) {
      setError("太ももは数値で入力してください");
      return;
    }
    await saveBodyMeasurementRecord({
      date: selectedDate,
      waistCm: parsedWaist,
      chestCm: chestCm !== "" ? parsedChest : undefined,
      thighCm: thighCm !== "" ? parsedThigh : undefined,
      note: note.trim() || undefined,
      timestamp: new Date(dateTime).toISOString(),
    });
    const cameFromHistory = editDate !== null && !isTodayParam;
    navigate(
      cameFromHistory ? "/trends" : "/",
      cameFromHistory ? { state: { viewMode: "history", historyKind: "bodyMeasurement" } } : undefined,
    );
  };

  const handleDelete = async () => {
    if (!isEditing) return;
    await deleteBodyMeasurementRecord(selectedDate);
    navigate("/trends", { state: { viewMode: "history", historyKind: "bodyMeasurement" } });
  };

  if (loadStatus === "loading") {
    return <Typography sx={{ p: 3, textAlign: "center", fontSize: 14, color: "text.secondary" }}>読み込み中...</Typography>;
  }

  if (loadStatus === "not-found") {
    return (
      <Box sx={{ mx: "auto", maxWidth: 448, px: "20px", pt: "16px", pb: "40px" }}>
        <RecordHeader title="記録が見つかりません" onBack={() => navigate("/trends", { state: { viewMode: "history", historyKind: "bodyMeasurement" } })} />
        <Card sx={{ p: "16px", mb: "16px" }}>
          <Typography sx={{ fontSize: 14, color: "text.secondary" }}>
            指定された日付のサイズの記録は見つかりませんでした。別の端末で削除された可能性があります。
          </Typography>
        </Card>
        <Button
          fullWidth
          variant="contained"
          onClick={() => navigate("/trends", { state: { viewMode: "history", historyKind: "bodyMeasurement" } })}
          sx={{ height: 50, borderRadius: "14px", boxShadow: tokens.primaryButtonShadow }}
        >
          履歴に戻る
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ mx: "auto", maxWidth: 448, px: "20px", pt: "16px", pb: "110px" }}>
      <RecordHeader title={isEditing ? "サイズを編集" : "サイズを記録"} onBack={() => navigate(-1)} />

      <Box component="form" onSubmit={handleSubmit}>
        <FieldLabel>日時</FieldLabel>
        <TextField
          fullWidth
          type="datetime-local"
          value={dateTime}
          onChange={(e) => setDateTime(e.target.value)}
          disabled={isEditing}
          helperText={isEditing ? "日時は編集できません" : "月1回など、同じ条件での測定をおすすめします"}
          sx={{ mb: "14px" }}
        />

        <Box sx={{ mb: "14px" }}>
          <CmField label="おなか周り" value={waistCm} onChange={setWaistCm} placeholder="80.0" big />
        </Box>

        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", mb: "14px" }}>
          <CmField label="胸囲" optional value={chestCm} onChange={setChestCm} placeholder="95.0" />
          <CmField label="太もも" optional value={thighCm} onChange={setThighCm} placeholder="52.0" />
        </Box>

        <FieldLabel optional>メモ</FieldLabel>
        <TextField
          fullWidth
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="測定条件 など"
        />

        {error && <Typography sx={{ mt: "12px", fontSize: 13, color: "primary.main" }}>{error}</Typography>}

        <RecordSaveFooter type="submit">
          {isEditing && (
            <Button fullWidth variant="text" onClick={handleDelete} sx={{ color: tokens.errorText, fontSize: 13 }}>
              この記録を削除
            </Button>
          )}
        </RecordSaveFooter>
      </Box>
    </Box>
  );
}
