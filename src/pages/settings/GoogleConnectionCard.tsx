import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { buildAuthorizationUrl, disconnectGoogle, fetchGoogleOAuthConfig } from "@/api/googleOAuth";
import { IconCheck, IconKey, IconWarning } from "@/components/icons";
import { getGoogleConnection } from "@/db/googleAuth";
import { formatDateTime } from "@/lib/date";
import { fontRounded, tokens } from "@/theme";

/**
 * ユーザー自身のGoogleアカウントとの連携(Issue #214)。
 *
 * 連携すると、記録の同期先スプレッドシートを**自分のDrive**に持てるようになる(#215・#216)。
 * 要求するスコープは `drive.file` だけで、**このアプリが作ったファイル以外は見えない** —
 * 相手に配るときの説明としてもここが要になるため、画面にも明示する。
 */
export default function GoogleConnectionCard() {
  // 「まだ読んでいない(undefined)」と「未連携(null)」を区別する(CLAUDE.mdのuseLiveQuery注意点)
  const connection = useLiveQuery(() => getGoogleConnection(), []);
  const [isConnecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const config = await fetchGoogleOAuthConfig();
      const url = await buildAuthorizationUrl(config);
      // 認可画面へ遷移する。戻り先は /oauth/callback(OAuthCallbackPage)
      location.assign(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Googleとの連携を開始できませんでした");
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setError(null);
    try {
      await disconnectGoogle();
    } catch {
      setError("連携の解除に失敗しました");
    }
  };

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
              color: "#2EC4B6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <IconKey size={18} />
          </Box>
          <Typography sx={{ flex: 1, fontSize: 14, fontWeight: 500 }}>Googleアカウント</Typography>
          {connection !== undefined && (
            <Typography
              sx={{
                fontFamily: fontRounded,
                fontWeight: 700,
                fontSize: 12,
                color: connection !== null ? tokens.secondaryDeep : "text.secondary",
              }}
            >
              {connection !== null ? "連携済み" : "未連携"}
            </Typography>
          )}
        </Box>

        {connection !== null && connection !== undefined && (
          <Box sx={{ display: "flex", alignItems: "center", gap: "6px", mb: "12px", color: tokens.secondaryDeep }}>
            <IconCheck size={13} />
            <Typography sx={{ fontSize: 11, color: tokens.secondaryDeep }}>
              {formatDateTime(connection.connectedAt)} に連携
            </Typography>
          </Box>
        )}

        <Typography sx={{ fontSize: 11, color: "text.secondary", lineHeight: 1.7, mb: "12px" }}>
          記録の保存先スプレッドシートを、あなた自身のGoogle Driveに置くための連携です。
          <Box component="span" sx={{ fontWeight: 700 }}>
            このアプリが作成したファイルにしかアクセスできません
          </Box>
          (Driveの他のファイルは見えません)。連携はいつでも解除できます
        </Typography>

        {connection === undefined ? (
          <Typography sx={{ fontSize: 12, color: "text.secondary" }}>読み込み中...</Typography>
        ) : connection === null ? (
          <Button
            fullWidth
            variant="contained"
            disabled={isConnecting}
            onClick={() => void handleConnect()}
            startIcon={isConnecting ? <CircularProgress size={14} color="inherit" /> : undefined}
            sx={{ height: 46, borderRadius: "13px", fontSize: 13, boxShadow: tokens.primaryButtonShadow }}
          >
            {isConnecting ? "Googleへ移動しています..." : "Googleと連携する"}
          </Button>
        ) : (
          <Button
            fullWidth
            variant="outlined"
            color="primary"
            onClick={() => void handleDisconnect()}
            sx={{ height: 44, borderRadius: "13px", fontSize: 13 }}
          >
            連携を解除する
          </Button>
        )}

        {error !== null && (
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: "7px", mt: "12px", bgcolor: tokens.errorBg, borderRadius: "11px", p: "10px 12px" }}>
            <Box sx={{ color: tokens.errorText, display: "flex", mt: "1px", flexShrink: 0 }}>
              <IconWarning size={13} />
            </Box>
            <Typography sx={{ fontSize: 11, fontWeight: 500, color: tokens.errorText, lineHeight: 1.5 }}>
              {error}
            </Typography>
          </Box>
        )}
      </Card>
      <Typography sx={{ fontSize: 11, color: "text.secondary", mb: "18px", px: "4px", lineHeight: 1.6 }}>
        端末ごとに連携が必要です(認可情報はこの端末にのみ保存され、バックアップにも同期先シートにも含まれません)
      </Typography>
    </>
  );
}
