import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { getGoogleAccessToken } from "@/api/googleOAuth";
import { IconCheck, IconShare, IconWarning } from "@/components/icons";
import { getGoogleConnection } from "@/db/googleAuth";
import { markAllRecordsUnsynced } from "@/db/resync";
import { getSettings, updateSettings } from "@/db/settings";
import { googleSheetsTransport } from "@/sync/googleSheetsTransport";
import { createSpreadsheet, spreadsheetUrlFor } from "@/sync/sheets/spreadsheetSetup";
import { runSync } from "@/sync/syncEngine";
import { fontRounded, tokens } from "@/theme";

/**
 * 同期先スプレッドシートの作成(Issue #216)。
 *
 * **`drive.file` スコープではアプリが作成したファイルにしかアクセスできない**ため、同期先は
 * 「アプリが作ったシート」である必要がある。既存シートのIDを手入力する経路は用意しない —
 * 入力できても権限が無く、Googleが403を返すだけになるため。
 *
 * **作成後は全レコードを未同期に戻す。** 新しいシートは空なのに手元のレコードは送信済みのままで、
 * そのままでは何も送られない。未同期に戻して一度同期すれば、手元の記録がそのまま新シートに載る。
 */
export default function SpreadsheetCard() {
  // 「まだ読んでいない(undefined)」と「無い(null)」を区別する(CLAUDE.mdのuseLiveQuery注意点)
  const connection = useLiveQuery(() => getGoogleConnection(), []);
  const spreadsheetId = useLiveQuery(() => getSettings().then((s) => s.spreadsheetId ?? null), []);
  const [isCreating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const accessToken = await getGoogleAccessToken();
      const created = await createSpreadsheet(accessToken);
      await updateSettings({ spreadsheetId: created.spreadsheetId });
      await markAllRecordsUnsynced();
      // **その場で書き出すところまでやる。** 未同期に戻すだけだと、自動同期のスロットリング(5分)に
      // 阻まれて見出し行だけのシートがしばらく残り、「すべて書き出します」の説明と食い違う
      const outcome = await runSync({ transport: googleSheetsTransport });
      if (outcome.status === "error") setError(outcome.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "スプレッドシートを作成できませんでした");
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <Card sx={{ p: "16px", mb: "8px" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: "12px" }}>
          <Typography sx={{ fontSize: 12, fontWeight: 500, color: "text.secondary" }}>同期先シート</Typography>
          {spreadsheetId !== undefined && (
            <Typography
              sx={{
                fontFamily: fontRounded,
                fontWeight: 700,
                fontSize: 12,
                color: spreadsheetId !== null ? tokens.secondaryDeep : "text.secondary",
              }}
            >
              {spreadsheetId !== null ? "作成済み" : "未作成"}
            </Typography>
          )}
        </Box>

        {spreadsheetId === null && connection === null && (
          <Typography sx={{ fontSize: 11, color: "text.secondary", lineHeight: 1.7 }}>
            先に上の「Googleアカウント」で連携してください。連携すると、あなたのGoogle
            Driveに記録用のスプレッドシートを作成できます
          </Typography>
        )}

        {spreadsheetId === null && connection !== null && connection !== undefined && (
          <>
            <Typography sx={{ fontSize: 11, color: "text.secondary", lineHeight: 1.7, mb: "12px" }}>
              あなたのGoogle Driveに記録用のスプレッドシートを作ります。作成後、手元の記録をすべて書き出します
            </Typography>
            <Button
              fullWidth
              variant="contained"
              color="secondary"
              disabled={isCreating}
              onClick={() => void handleCreate()}
              startIcon={isCreating ? <CircularProgress size={14} color="inherit" /> : undefined}
              sx={{ height: 46, borderRadius: "13px", fontSize: 13, boxShadow: tokens.secondaryButtonShadow }}
            >
              {isCreating ? "作成して書き出しています..." : "スプレッドシートを作成"}
            </Button>
          </>
        )}

        {spreadsheetId !== null && spreadsheetId !== undefined && (
          <>
            <Box sx={{ display: "flex", alignItems: "center", gap: "6px", mb: "12px", color: tokens.secondaryDeep }}>
              <IconCheck size={13} />
              <Typography sx={{ fontSize: 11, color: tokens.secondaryDeep }}>
                あなたのGoogle Driveに作成済みです
              </Typography>
            </Box>
            <Button
              fullWidth
              variant="outlined"
              color="secondary"
              component="a"
              href={spreadsheetUrlFor(spreadsheetId)}
              target="_blank"
              rel="noreferrer"
              startIcon={<IconShare size={16} />}
              sx={{ height: 44, borderRadius: "13px", fontSize: 13 }}
            >
              シートを開く
            </Button>
          </>
        )}

        {error !== null && (
          <Box
            sx={{
              display: "flex",
              alignItems: "flex-start",
              gap: "7px",
              mt: "12px",
              bgcolor: tokens.errorBg,
              borderRadius: "11px",
              p: "10px 12px",
            }}
          >
            <Box sx={{ color: tokens.errorText, display: "flex", mt: "1px", flexShrink: 0 }}>
              <IconWarning size={13} />
            </Box>
            <Typography sx={{ fontSize: 11, fontWeight: 500, color: tokens.errorText, lineHeight: 1.5 }}>
              {error}
            </Typography>
          </Box>
        )}
      </Card>
    </>
  );
}
