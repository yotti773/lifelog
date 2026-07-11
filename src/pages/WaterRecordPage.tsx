import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Card from "@mui/material/Card";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import RecordHeader from "@/components/RecordHeader";
import SectionLabel from "@/components/SectionLabel";
import { IconClose, IconDrop } from "@/components/icons";
import { addWaterRecord, deleteWaterRecord, getWaterRecordsForDate } from "@/db/waterRecords";
import { getSettings } from "@/db/settings";
import { formatTime, todayDateString } from "@/lib/date";
import { fontRounded, tokens } from "@/theme";

/** クイック追加ボタンの量(ml)。MVPでは固定値(画面設計書5章) */
const QUICK_AMOUNTS = [100, 200, 350, 500] as const;
/** プライマリ強調するボタン(モックでは500mlが強調されている) */
const PRIMARY_AMOUNT = 500;

export default function WaterRecordPage() {
  const navigate = useNavigate();
  const today = todayDateString();

  const records = useLiveQuery(() => getWaterRecordsForDate(today), [today]);
  const settings = useLiveQuery(() => getSettings(), []);

  if (records === undefined || settings === undefined) {
    return <Typography sx={{ p: 3, textAlign: "center", fontSize: 14, color: "text.secondary" }}>読み込み中...</Typography>;
  }

  const totalMl = records.reduce((sum, record) => sum + record.amountMl, 0);
  const targetMl = settings.dailyWaterTargetMl;
  const progress = targetMl ? Math.max(0, Math.min(100, (totalMl / targetMl) * 100)) : 0;
  // 記録リストは新しい記録が上(画面設計書5章)
  const newestFirst = [...records].reverse();

  return (
    <Box sx={{ mx: "auto", maxWidth: 448, px: "20px", pt: "16px", pb: "40px" }}>
      <RecordHeader title="水分を記録" onBack={() => navigate("/")} />

      {/* 今日の合計カード */}
      <Card sx={{ p: "22px 18px", mb: "18px", textAlign: "center", bgcolor: tokens.waterCardBg }}>
        <Typography sx={{ fontSize: 12, fontWeight: 500, color: tokens.waterInk, mb: "8px" }}>今日の合計</Typography>
        <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: "6px", mb: "14px" }}>
          <Typography sx={{ fontFamily: fontRounded, fontWeight: 800, fontSize: 44, lineHeight: 1, color: tokens.waterDeep }}>
            {totalMl.toLocaleString()}
          </Typography>
          <Typography sx={{ fontFamily: fontRounded, fontWeight: 500, fontSize: 15, color: tokens.waterInk }}>
            {targetMl ? `/ ${targetMl.toLocaleString()} ml` : " ml"}
          </Typography>
        </Box>
        {targetMl ? (
          <Box sx={{ height: 12, bgcolor: tokens.waterTrack, borderRadius: "8px", overflow: "hidden" }}>
            <Box
              sx={{
                height: "100%",
                width: `${progress}%`,
                background: tokens.waterBarGradient,
                borderRadius: "8px",
                transition: "width .4s",
              }}
            />
          </Box>
        ) : (
          <Typography sx={{ fontSize: 11, color: "text.secondary" }}>
            設定画面で目標を設定すると、達成度を表示できます
          </Typography>
        )}
      </Card>

      {/* クイック追加 */}
      <SectionLabel>クイック追加</SectionLabel>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", mb: "20px" }}>
        {QUICK_AMOUNTS.map((amount) => {
          const isPrimary = amount === PRIMARY_AMOUNT;
          return (
            <ButtonBase
              key={amount}
              onClick={() => addWaterRecord(amount)}
              aria-label={`${amount}mlを記録する`}
              sx={{
                flexDirection: "column",
                bgcolor: isPrimary ? tokens.waterDeep : "background.paper",
                border: `1.5px solid ${isPrimary ? tokens.waterDeep : tokens.waterTrack}`,
                borderRadius: "14px",
                py: "14px",
                boxShadow: isPrimary ? tokens.waterPrimaryButtonShadow : tokens.waterButtonShadow,
              }}
            >
              <Typography sx={{ fontFamily: fontRounded, fontWeight: 800, fontSize: 18, color: isPrimary ? "#fff" : tokens.waterDeep }}>
                {amount}
              </Typography>
              <Typography sx={{ fontSize: 9, fontWeight: 500, color: isPrimary ? "#CFE6F4" : "text.secondary" }}>ml</Typography>
            </ButtonBase>
          );
        })}
      </Box>

      {/* 今日の記録 */}
      <SectionLabel>今日の記録</SectionLabel>
      {newestFirst.length > 0 ? (
        <Card sx={{ overflow: "hidden" }}>
          {newestFirst.map((record, index) => (
            <Box
              key={record.id}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                p: "13px 15px",
                borderBottom: index < newestFirst.length - 1 ? `1px solid ${tokens.divider}` : "none",
              }}
            >
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: "10px",
                  bgcolor: tokens.waterSoft,
                  color: tokens.waterMain,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <IconDrop size={15} />
              </Box>
              <Typography sx={{ flex: 1, fontSize: 12, color: "text.secondary" }}>{formatTime(record.timestamp)}</Typography>
              <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 15 }}>
                {record.amountMl}
                <Box component="span" sx={{ fontSize: 10, color: "text.secondary", fontWeight: 500, ml: "1px" }}>
                  ml
                </Box>
              </Typography>
              <IconButton
                onClick={() => deleteWaterRecord(record.id)}
                aria-label={`${formatTime(record.timestamp)}の${record.amountMl}mlを削除`}
                sx={{ width: 28, height: 28, borderRadius: "8px", bgcolor: tokens.beigeSoft, color: tokens.faint, flexShrink: 0 }}
              >
                <IconClose />
              </IconButton>
            </Box>
          ))}
        </Card>
      ) : (
        <Typography sx={{ textAlign: "center", p: "30px 20px", fontSize: 13, color: tokens.faint }}>
          まだ記録がありません
        </Typography>
      )}
    </Box>
  );
}
