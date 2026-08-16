import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Drawer from "@mui/material/Drawer";
import Typography from "@mui/material/Typography";
import { IconCheck, IconSparkle, IconWarning } from "@/components/icons";
import { agreeToAiConsent, withdrawAiConsent } from "@/db/settings";
import { fontRounded, tokens } from "@/theme";

/**
 * AI機能でGoogle Gemini APIへ何を送るかの説明と、同意・撤回の導線(Issue #219)。
 *
 * 自分ひとりで使う間は自分のデータを自分で送っているだけだが、他人に配ると**他人の健康データを
 * 第三者へ送る**ことになる。健康データは要配慮個人情報にあたるため、無償配布でも省略できない。
 * 文言は要件定義書5.3のプライバシー方針を利用者向けに起こしたもので、新しい方針は作っていない。
 *
 * 同意しなくても記録・同期は使える(AI機能だけが使えない)。
 */

/** 送信されるものの内訳。「何が送られるか」を機能ごとに具体的に示す */
const SENT_ITEMS = [
  {
    title: "週次・月次のAIコメント",
    body: "その期間の集計値(体重の平均・摂取カロリー・PFC・記録日数など)が送られます。個々の記録そのものは送られません",
  },
  {
    title: "食事の写真・テキスト判定",
    body: "撮影した写真、または入力したテキストが送られます",
  },
] as const;

/** 送信されないものの内訳。伏せずに書くことで、同意の範囲を具体的にする */
const NOT_SENT_ITEMS = [
  "日記の本文(設定でONにしたときだけ、週次コメントに含まれます)",
  "記録そのもの(体重・食事・水分などは、あなた自身のスプレッドシートにのみ保存されます)",
] as const;

interface AiConsentDialogProps {
  open: boolean;
  /** 同意済みか。撤回ボタンの出し分けと、下部ボタンの文言に使う */
  agreed: boolean;
  onClose: () => void;
  /** 同意した直後に呼ばれる。呼び出し元が「同意を待っていた操作」を続ける用 */
  onAgreed?: () => void;
}

export default function AiConsentDialog({ open, agreed, onClose, onAgreed }: AiConsentDialogProps) {
  // 保存に失敗したまま黙って閉じると、同意したつもりの人がAI機能を使えず理由も分からない。
  // 失敗したときはシートを開いたままエラーを出し、待っていた操作(onAgreed)も進めない
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleAgree = async () => {
    setSaveError(null);
    try {
      await agreeToAiConsent();
    } catch {
      setSaveError("同意の保存に失敗しました。もう一度お試しください");
      return;
    }
    onClose();
    onAgreed?.();
  };

  const handleWithdraw = async () => {
    setSaveError(null);
    try {
      await withdrawAiConsent();
    } catch {
      setSaveError("取り消しの保存に失敗しました。もう一度お試しください");
      return;
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
          sx: {
            bgcolor: "background.default",
            borderRadius: "28px 28px 0 0",
            p: "12px 20px 30px",
            mx: "auto",
            maxWidth: 448,
            width: "100%",
          },
        },
      }}
    >
      <Box sx={{ width: 40, height: 5, borderRadius: "3px", bgcolor: "#E2D8C9", mx: "auto", mb: "18px" }} />

      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", mb: "6px" }}>
        <Box sx={{ color: "primary.main", display: "flex" }}>
          <IconSparkle size={16} />
        </Box>
        <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 16 }}>
          AI機能とデータの送信について
        </Typography>
      </Box>
      <Typography sx={{ fontSize: 11, color: "text.secondary", textAlign: "center", mb: "18px", lineHeight: 1.6 }}>
        AI機能を使うと、以下の内容が Google の Gemini API へ送信されます
      </Typography>

      <Typography sx={{ fontSize: 11, fontWeight: 700, color: "primary.main", mb: "8px" }}>送信されるもの</Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: "10px", mb: "16px" }}>
        {SENT_ITEMS.map((item) => (
          <Box key={item.title} sx={{ bgcolor: tokens.primarySoft, borderRadius: "12px", p: "10px 13px" }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, mb: "3px" }}>{item.title}</Typography>
            <Typography sx={{ fontSize: 11, color: "text.secondary", lineHeight: 1.6 }}>{item.body}</Typography>
          </Box>
        ))}
      </Box>

      <Typography sx={{ fontSize: 11, fontWeight: 700, color: tokens.secondaryDeep, mb: "8px" }}>
        送信されないもの
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: "7px", mb: "16px" }}>
        {NOT_SENT_ITEMS.map((text) => (
          <Box key={text} sx={{ display: "flex", alignItems: "flex-start", gap: "7px" }}>
            <Box sx={{ color: "secondary.main", display: "flex", mt: "2px", flexShrink: 0 }}>
              <IconCheck size={13} />
            </Box>
            <Typography sx={{ fontSize: 11, color: "text.secondary", lineHeight: 1.6 }}>{text}</Typography>
          </Box>
        ))}
      </Box>

      <Typography
        sx={{
          fontSize: 11,
          color: "text.secondary",
          lineHeight: 1.7,
          bgcolor: tokens.beigeSoft,
          borderRadius: "12px",
          p: "10px 13px",
          mb: "18px",
        }}
      >
        同意しなくても、記録・グラフ・スプレッドシート同期はすべて使えます(AI機能だけが使えません)。
        同意はあとから設定画面で取り消せます。AIの出力は参考情報であり、医学的助言ではありません
      </Typography>

      {agreed ? (
        <>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", mb: "12px", color: tokens.secondaryDeep }}>
            <IconCheck size={14} />
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: tokens.secondaryDeep }}>同意済みです</Typography>
          </Box>
          <Button
            fullWidth
            variant="outlined"
            color="primary"
            onClick={handleWithdraw}
            sx={{ height: 46, borderRadius: "13px", fontSize: 13 }}
          >
            同意を取り消す
          </Button>
        </>
      ) : (
        <Button
          fullWidth
          variant="contained"
          onClick={handleAgree}
          sx={{ height: 48, borderRadius: "13px", fontSize: 14, boxShadow: tokens.primaryButtonShadow }}
        >
          同意してAI機能を使う
        </Button>
      )}
      {saveError && (
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: "7px", mt: "12px", bgcolor: tokens.errorBg, borderRadius: "11px", p: "10px 12px" }}>
          <Box sx={{ color: tokens.errorText, display: "flex", mt: "1px", flexShrink: 0 }}>
            <IconWarning size={13} />
          </Box>
          <Typography sx={{ fontSize: 11, fontWeight: 500, color: tokens.errorText, lineHeight: 1.5 }}>
            {saveError}
          </Typography>
        </Box>
      )}

      <Button fullWidth onClick={onClose} sx={{ mt: "8px", height: 40, fontSize: 12, color: "text.secondary" }}>
        閉じる
      </Button>
    </Drawer>
  );
}
