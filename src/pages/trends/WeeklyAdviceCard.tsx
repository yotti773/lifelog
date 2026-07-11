import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { IconCheck, IconSparkle, IconWarning } from "@/components/icons";
import { requestWeeklyAdvice } from "@/api/weeklyAdvice";
import { getAdviceRecord, saveAdviceRecord } from "@/db/adviceRecords";
import { formatDateTime } from "@/lib/date";
import { fontRounded, tokens } from "@/theme";
import type { WeeklyAdvice, WeeklyDigest } from "@/types";

// verdictの表示(4値→ラベル・3色)。teal=順調 / amber=やや遅れ / coral=遅れ・要注意
const VERDICT_STYLES: Record<WeeklyAdvice["verdict"], { label: string; color: string; bg: string }> = {
  on_track: { label: "順調", color: tokens.secondaryDeep, bg: tokens.secondarySoft },
  slightly_behind: { label: "やや遅れ", color: tokens.warnText, bg: tokens.warnBg },
  behind: { label: "遅れ気味", color: tokens.errorText, bg: tokens.errorBg },
  needs_attention: { label: "要注意", color: tokens.errorText, bg: tokens.errorBg },
};

interface WeeklyAdviceCardProps {
  digest: WeeklyDigest;
}

/** AIコーチのコメントカード(Issue #12)。生成はユーザーの明示操作でのみ行い、生成済みの週はキャッシュを表示する */
export default function WeeklyAdviceCard({ digest }: WeeklyAdviceCardProps) {
  const [isGenerating, setGenerating] = useState(false);
  const [adviceError, setAdviceError] = useState<string | null>(null);

  const weekStart = digest.period.start;
  // 生成済みの週はキャッシュを表示する(Issue #12)。「未生成」もnullに解決してロード中と区別する
  const cachedAdvice = useLiveQuery(
    () => getAdviceRecord(weekStart).then((v) => v ?? null),
    [weekStart],
  );

  const handleGenerateAdvice = async () => {
    if (!navigator.onLine) {
      setAdviceError("オフラインのため生成できません");
      return;
    }
    setGenerating(true);
    setAdviceError(null);
    try {
      const advice = await requestWeeklyAdvice(digest);
      // 生成時のdigestも一緒に保存する(何を根拠にこのコメントが出たかを後から再現できるように)
      await saveAdviceRecord(weekStart, digest, advice);
    } catch (error) {
      setAdviceError(error instanceof Error ? error.message : "生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card sx={{ p: "18px" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: "6px", mb: "12px" }}>
        <Box sx={{ color: "primary.main", display: "flex" }}>
          <IconSparkle size={15} />
        </Box>
        <Typography sx={{ flex: 1, fontSize: 12, fontWeight: 700, color: "text.secondary" }}>
          AIコーチのコメント
        </Typography>
        {cachedAdvice && !isGenerating && (
          <Button
            size="small"
            onClick={handleGenerateAdvice}
            sx={{ fontSize: 11, color: "text.secondary", minWidth: 0, p: "2px 8px" }}
          >
            再生成
          </Button>
        )}
      </Box>

      {isGenerating ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: "10px", py: "10px" }}>
          <CircularProgress size={18} color="secondary" />
          <Typography sx={{ fontSize: 12, color: "text.secondary" }}>コメントを生成しています...</Typography>
        </Box>
      ) : cachedAdvice ? (
        <>
          <Box sx={{ display: "flex", alignItems: "center", gap: "8px", mb: "10px" }}>
            <Typography
              sx={{
                fontFamily: fontRounded,
                fontWeight: 700,
                fontSize: 11,
                color: VERDICT_STYLES[cachedAdvice.advice.verdict].color,
                bgcolor: VERDICT_STYLES[cachedAdvice.advice.verdict].bg,
                px: "10px",
                py: "4px",
                borderRadius: "20px",
              }}
            >
              {VERDICT_STYLES[cachedAdvice.advice.verdict].label}
            </Typography>
            <Typography sx={{ fontSize: 10, color: tokens.faint }}>
              {formatDateTime(cachedAdvice.createdAt)} 生成
            </Typography>
          </Box>
          <Typography sx={{ fontSize: 13, lineHeight: 1.8, mb: "14px" }}>{cachedAdvice.advice.summary}</Typography>

          <Typography sx={{ fontSize: 11, fontWeight: 700, color: tokens.secondaryDeep, mb: "6px" }}>
            続けたいこと
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: "5px", mb: "14px" }}>
            {cachedAdvice.advice.wins.map((win) => (
              <Box key={win} sx={{ display: "flex", alignItems: "flex-start", gap: "7px" }}>
                <Box sx={{ color: "secondary.main", display: "flex", mt: "3px", flexShrink: 0 }}>
                  <IconCheck size={13} />
                </Box>
                <Typography sx={{ fontSize: 12, lineHeight: 1.7 }}>{win}</Typography>
              </Box>
            ))}
          </Box>

          <Typography sx={{ fontSize: 11, fontWeight: 700, color: "primary.main", mb: "6px" }}>
            来週やってみること
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {cachedAdvice.advice.actions.map((action, index) => (
              <Box key={action} sx={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                <Typography
                  sx={{
                    fontFamily: fontRounded,
                    fontWeight: 700,
                    fontSize: 11,
                    color: "primary.main",
                    bgcolor: tokens.primarySoft,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    mt: "2px",
                  }}
                >
                  {index + 1}
                </Typography>
                <Typography sx={{ fontSize: 12, lineHeight: 1.7 }}>{action}</Typography>
              </Box>
            ))}
          </Box>
        </>
      ) : (
        <>
          <Typography sx={{ fontSize: 12, color: "text.secondary", lineHeight: 1.7, mb: "12px" }}>
            この週の実績サマリーをもとに、総評・良かった点・来週のアクションをAIが提案します
          </Typography>
          <Button
            fullWidth
            variant="contained"
            onClick={handleGenerateAdvice}
            startIcon={<IconSparkle />}
            sx={{ height: 44, borderRadius: "13px", fontSize: 13, boxShadow: tokens.primaryButtonShadow }}
          >
            コメントを生成する
          </Button>
        </>
      )}

      {adviceError && !isGenerating && (
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: "7px", mt: "12px", bgcolor: tokens.errorBg, borderRadius: "11px", p: "10px 12px" }}>
          <Box sx={{ color: tokens.errorText, display: "flex", mt: "1px", flexShrink: 0 }}>
            <IconWarning size={13} />
          </Box>
          <Typography sx={{ fontSize: 11, fontWeight: 500, color: tokens.errorText, lineHeight: 1.5 }}>
            生成に失敗しました({adviceError})。時間をおいて再試行してください
          </Typography>
        </Box>
      )}

      {/* 医療免責(AIコンサルティング設計書7章)。AI欄の近くに常設する */}
      <Typography sx={{ fontSize: 10, color: tokens.faint, mt: "14px", pt: "10px", borderTop: `1px solid ${tokens.divider}`, lineHeight: 1.6 }}>
        AIによる参考情報であり、医学的助言ではありません
      </Typography>
    </Card>
  );
}
