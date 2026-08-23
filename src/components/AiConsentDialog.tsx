import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import Typography from "@mui/material/Typography";
import { IconCheck, IconClose, IconSparkle } from "@/components/icons";
import { fontRounded, tokens } from "@/theme";

/**
 * AIへの送信に対する同意ダイアログ(Issue #219)。
 *
 * **送信先(GoogleのGemini API)と、送るもの・送らないものを具体的に出す。** 伏せない。
 * ここの文章は配布時の説明にもそのまま使える形にしてある(プライバシーポリシー #238 の4章と同じ内容)。
 *
 * `readOnly` は設定画面から中身を読み直すとき用。同意/やめるではなく「閉じる」だけを出す。
 */

/** 送るもの・送らないものの一覧。ポリシー画面(`PrivacyPolicyPage`)と同じ粒度でそろえる */
const SENT_ITEMS = ["食事の写真・入力したテキスト", "記録の要約(体重・カロリー・PFC・歩数など)", "日記の気分タグ(件数のみ)"];
const NOT_SENT_ITEMS = ["日記の本文(設定でONにしたときだけ送る)", "氏名・メールアドレス"];

interface AiConsentDialogProps {
  open: boolean;
  readOnly?: boolean;
  onAgree?: () => void;
  onClose: () => void;
}

export default function AiConsentDialog({ open, readOnly = false, onAgree, onClose }: AiConsentDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { borderRadius: "22px", m: "20px", maxWidth: 380, width: "100%" } } }}
    >
      <Box sx={{ p: "22px 20px 20px" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: "10px", mb: "14px" }}>
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: "11px",
              bgcolor: tokens.secondarySoft,
              color: tokens.secondaryDeep,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <IconSparkle size={18} />
          </Box>
          <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 16 }}>AIに送る内容</Typography>
        </Box>

        <Typography sx={{ fontSize: 12, lineHeight: 1.9, color: "#4A4A4A", mb: "14px" }}>
          食事の判定とレビューのコメント生成には、
          <Box component="span" sx={{ fontWeight: 700, color: "text.primary" }}>
            GoogleのGemini API
          </Box>
          を使います。利用するには、次の内容が送られることへの同意が必要です。
        </Typography>

        <Box sx={{ bgcolor: tokens.beigeSoft, borderRadius: "16px", p: "14px 15px", mb: "14px" }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: "primary.main", mb: "8px" }}>送るもの</Typography>
          {SENT_ITEMS.map((item) => (
            <Box key={item} sx={{ display: "flex", alignItems: "flex-start", gap: "7px", mb: "5px" }}>
              <Box sx={{ color: "primary.main", display: "flex", mt: "2px", flexShrink: 0 }}>
                <IconCheck size={12} />
              </Box>
              <Typography sx={{ fontSize: 11.5, lineHeight: 1.6, color: "#4A4A4A" }}>{item}</Typography>
            </Box>
          ))}
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: tokens.secondaryDeep, mt: "12px", mb: "8px" }}>
            送らないもの
          </Typography>
          {NOT_SENT_ITEMS.map((item) => (
            <Box key={item} sx={{ display: "flex", alignItems: "flex-start", gap: "7px", mb: "5px" }}>
              <Box sx={{ color: tokens.secondaryDeep, display: "flex", mt: "2px", flexShrink: 0 }}>
                <IconClose size={12} />
              </Box>
              <Typography sx={{ fontSize: 11.5, lineHeight: 1.6, color: "#4A4A4A" }}>{item}</Typography>
            </Box>
          ))}
        </Box>

        <Typography sx={{ fontSize: 11, lineHeight: 1.8, color: "text.secondary", mb: "18px" }}>
          記録そのものは運営者のサーバーに保存されません(あなたのGoogle
          Driveのスプレッドシートにだけ保存されます)。同意しなくても、記録・グラフ・同期はすべて使えます。同意はいつでも設定画面から取り消せます。
        </Typography>

        {readOnly ? (
          <Button
            fullWidth
            variant="outlined"
            color="secondary"
            onClick={onClose}
            sx={{ height: 46, borderRadius: "13px", fontSize: 13 }}
          >
            閉じる
          </Button>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <Button
              fullWidth
              variant="contained"
              color="secondary"
              onClick={onAgree}
              sx={{ height: 46, borderRadius: "13px", fontSize: 13, boxShadow: tokens.secondaryButtonShadow }}
            >
              同意してAIを使う
            </Button>
            <Button
              fullWidth
              variant="text"
              onClick={onClose}
              sx={{ height: 42, borderRadius: "13px", fontSize: 13, color: "text.secondary" }}
            >
              今は使わない
            </Button>
          </Box>
        )}
      </Box>
    </Dialog>
  );
}
