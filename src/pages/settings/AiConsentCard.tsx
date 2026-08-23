import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import AiConsentDialog from "@/components/AiConsentDialog";
import { IconCheck, IconSparkle } from "@/components/icons";
import { getAiConsentAt, grantAiConsent, revokeAiConsent } from "@/db/aiConsent";
import { formatDateTime } from "@/lib/date";
import { fontRounded, tokens } from "@/theme";

/**
 * AIへの送信の同意状態(Issue #219)。
 *
 * ここは**確認と取り消しのための場所**で、同意そのものはAI機能を使う直前に取る
 * (`useAiConsentGate`)。未同意のまま設定画面からも同意できるようにしてあるのは、
 * 配布相手に「先に中身を読んでから決める」経路を残すため。
 */
export default function AiConsentCard() {
  // 「まだ読んでいない(undefined)」と「未同意(null)」を区別する
  const consentAt = useLiveQuery(() => getAiConsentAt(), []);
  const [dialogOpen, setDialogOpen] = useState(false);

  const consented = consentAt !== null && consentAt !== undefined;

  return (
    <>
      <Card sx={{ p: "16px", mb: "8px" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: "13px", mb: "12px" }}>
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
          <Typography sx={{ flex: 1, fontSize: 14, fontWeight: 500 }}>AIに送る内容</Typography>
          {consentAt !== undefined && (
            <Typography
              sx={{
                fontFamily: fontRounded,
                fontWeight: 700,
                fontSize: 12,
                color: consented ? tokens.secondaryDeep : "text.secondary",
              }}
            >
              {consented ? "同意済み" : "未同意"}
            </Typography>
          )}
        </Box>

        {consented && (
          <Box sx={{ display: "flex", alignItems: "center", gap: "6px", mb: "12px", color: tokens.secondaryDeep }}>
            <IconCheck size={13} />
            <Typography sx={{ fontSize: 11, color: tokens.secondaryDeep }}>
              {formatDateTime(consentAt)} に同意
            </Typography>
          </Box>
        )}

        <Typography sx={{ fontSize: 11, color: "text.secondary", lineHeight: 1.7, mb: "12px" }}>
          食事の判定とレビューのコメント生成では、GoogleのGemini APIへ写真や記録の要約が送られます。
          <Box component="span" sx={{ fontWeight: 700 }}>
            同意しなくても記録・グラフ・同期はすべて使えます
          </Box>
        </Typography>

        <Box sx={{ display: "flex", gap: "8px" }}>
          <Button
            fullWidth
            variant="outlined"
            color="secondary"
            onClick={() => setDialogOpen(true)}
            sx={{ height: 44, borderRadius: "13px", fontSize: 13 }}
          >
            送る内容を見る
          </Button>
          {consented ? (
            <Button
              fullWidth
              variant="text"
              onClick={() => void revokeAiConsent()}
              sx={{ height: 44, borderRadius: "13px", fontSize: 13, color: "text.secondary" }}
            >
              同意を取り消す
            </Button>
          ) : (
            <Button
              fullWidth
              variant="contained"
              color="secondary"
              onClick={() => void grantAiConsent()}
              sx={{ height: 44, borderRadius: "13px", fontSize: 13, boxShadow: tokens.secondaryButtonShadow }}
            >
              同意する
            </Button>
          )}
        </Box>
      </Card>

      {/* 設定画面からは読むだけ。同意の操作は上のボタンで行う */}
      <AiConsentDialog open={dialogOpen} readOnly onClose={() => setDialogOpen(false)} />
    </>
  );
}
