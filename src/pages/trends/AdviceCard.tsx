import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { isApiConnectionError } from "@/api/request";
import AiConsentDialog from "@/components/AiConsentDialog";
import { IconCheck, IconSparkle, IconWarning } from "@/components/icons";
import { getSettings, hasAiConsent } from "@/db/settings";
import { formatDateTime } from "@/lib/date";
import { fontRounded, tokens } from "@/theme";
import type { WeeklyAdvice } from "@/types";

// verdictの表示(4値→ラベル・3色)。teal=順調 / amber=やや遅れ / coral=遅れ・要注意
const VERDICT_STYLES: Record<WeeklyAdvice["verdict"], { label: string; color: string; bg: string }> = {
  on_track: { label: "順調", color: tokens.secondaryDeep, bg: tokens.secondarySoft },
  slightly_behind: { label: "やや遅れ", color: tokens.warnText, bg: tokens.warnBg },
  behind: { label: "遅れ気味", color: tokens.errorText, bg: tokens.errorBg },
  needs_attention: { label: "要注意", color: tokens.errorText, bg: tokens.errorBg },
};

/** selfContained=true のメッセージは、それ自体で原因と対処が分かるためカード側で言い回しを足さない */
interface AdviceError {
  message: string;
  selfContained: boolean;
}

interface AdviceCardProps {
  title: string;
  /** wins欄の見出し(週次=「続けたいこと」、月次=「今月の良かった変化」) */
  winsLabel: string;
  /** actions欄の見出し(週次=「来週やってみること」、月次=「来月の重点」) */
  actionsLabel: string;
  /** 未生成時に生成ボタンの上へ出す説明文 */
  emptyDescription: string;
  /** 生成済みキャッシュ。undefined=ロード中(未生成扱いで生成ボタンを出す)/ null=未生成 */
  cached: { advice: WeeklyAdvice; createdAt: string } | null | undefined;
  /** コメントを生成してキャッシュへ保存する(失敗はthrow)。オンライン判定・進行状態はカード側が持つ */
  generate: () => Promise<void>;
}

/**
 * AIコーチのコメントカードの共通表示(Issue #12・#114)。生成はユーザーの明示操作でのみ行い、
 * 生成済みの期間はキャッシュを表示する。出力契約(verdict/summary/wins/actions)は週次・月次で共通。
 */
export default function AdviceCard({
  title,
  winsLabel,
  actionsLabel,
  emptyDescription,
  cached,
  generate,
}: AdviceCardProps) {
  const [isGenerating, setGenerating] = useState(false);
  const [adviceError, setAdviceError] = useState<AdviceError | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  // 同意状態(Issue #219)。undefined=ロード中は未同意側に倒し、同意ダイアログを先に出す
  const agreed = useLiveQuery(() => getSettings().then(hasAiConsent), []);

  const runGenerate = async () => {
    setGenerating(true);
    setAdviceError(null);
    try {
      await generate();
    } catch (error) {
      setAdviceError({
        message: error instanceof Error ? error.message : "生成に失敗しました",
        // 接続できなかった場合は原因も対処もメッセージ側に書いてあるので、そのまま出す(Issue #204)
        selfContained: isApiConnectionError(error),
      });
    } finally {
      setGenerating(false);
    }
  };

  // 未同意なら送信せず、まず同意ダイアログを出す(Issue #219)。同意したらそのまま生成へ進む。
  // ロード中(undefined)は「未同意」と決めつけない — 同意済みの人にダイアログを出してしまうため、
  // 解決するまでボタン自体を押せなくする
  const handleGenerateAdvice = () => {
    if (agreed === undefined) return;
    if (!navigator.onLine) {
      setAdviceError({ message: "オフラインのため生成できません", selfContained: true });
      return;
    }
    if (!agreed) {
      setConsentOpen(true);
      return;
    }
    void runGenerate();
  };

  return (
    <Card sx={{ p: "18px" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: "6px", mb: "12px" }}>
        <Box sx={{ color: "primary.main", display: "flex" }}>
          <IconSparkle size={15} />
        </Box>
        <Typography sx={{ flex: 1, fontSize: 12, fontWeight: 700, color: "text.secondary" }}>
          {title}
        </Typography>
        {cached && !isGenerating && (
          <Button
            size="small"
            disabled={agreed === undefined}
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
      ) : cached ? (
        <>
          <Box sx={{ display: "flex", alignItems: "center", gap: "8px", mb: "10px" }}>
            <Typography
              sx={{
                fontFamily: fontRounded,
                fontWeight: 700,
                fontSize: 11,
                color: VERDICT_STYLES[cached.advice.verdict].color,
                bgcolor: VERDICT_STYLES[cached.advice.verdict].bg,
                px: "10px",
                py: "4px",
                borderRadius: "20px",
              }}
            >
              {VERDICT_STYLES[cached.advice.verdict].label}
            </Typography>
            <Typography sx={{ fontSize: 10, color: tokens.faint }}>
              {formatDateTime(cached.createdAt)} 生成
            </Typography>
          </Box>
          <Typography sx={{ fontSize: 13, lineHeight: 1.8, mb: "14px" }}>{cached.advice.summary}</Typography>

          <Typography sx={{ fontSize: 11, fontWeight: 700, color: tokens.secondaryDeep, mb: "6px" }}>
            {winsLabel}
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: "5px", mb: "14px" }}>
            {cached.advice.wins.map((win) => (
              <Box key={win} sx={{ display: "flex", alignItems: "flex-start", gap: "7px" }}>
                <Box sx={{ color: "secondary.main", display: "flex", mt: "3px", flexShrink: 0 }}>
                  <IconCheck size={13} />
                </Box>
                <Typography sx={{ fontSize: 12, lineHeight: 1.7 }}>{win}</Typography>
              </Box>
            ))}
          </Box>

          <Typography sx={{ fontSize: 11, fontWeight: 700, color: "primary.main", mb: "6px" }}>
            {actionsLabel}
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {cached.advice.actions.map((action, index) => (
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
            {emptyDescription}
          </Typography>
          <Button
            fullWidth
            variant="contained"
            disabled={agreed === undefined}
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
            {adviceError.selfContained
              ? adviceError.message
              : `生成に失敗しました(${adviceError.message})。時間をおいて再試行してください`}
          </Typography>
        </Box>
      )}

      {/* 医療免責(AIコンサルティング設計書7章)。AI欄の近くに常設する */}
      <Typography sx={{ fontSize: 10, color: tokens.faint, mt: "14px", pt: "10px", borderTop: `1px solid ${tokens.divider}`, lineHeight: 1.6 }}>
        AIによる参考情報であり、医学的助言ではありません
      </Typography>

      <AiConsentDialog
        open={consentOpen}
        agreed={agreed === true}
        onClose={() => setConsentOpen(false)}
        onAgreed={() => void runGenerate()}
      />
    </Card>
  );
}
