import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import { IconSync, IconWarning } from "@/components/icons";
import { resetAppShell } from "@/lib/appReset";
import { fontRounded, tokens } from "@/theme";

type Status = { kind: "idle" } | { kind: "confirm" } | { kind: "error"; message: string };

/**
 * 設定画面の「アプリのリセット」カード(Issue #203)。
 *
 * Service Workerとキャッシュだけを捨てて取り直す。記録(IndexedDB)には触れないため、
 * PWAの再インストール(ストレージごと消えうる)を避けて通信不能状態から復旧できる。
 * 成功時はそのままリロードして、まっさらな状態でSWを登録し直させる。
 */
export default function AppResetCard() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [isResetting, setResetting] = useState(false);

  const handleReset = async () => {
    setResetting(true);
    try {
      await resetAppShell();
      // リロードでSWが登録し直される。成功表示は出さない(リロードで消えるため)
      window.location.reload();
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "アプリのリセットに失敗しました" });
      setResetting(false);
    }
  };

  return (
    <Card sx={{ p: "16px", mb: "18px" }}>
      <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 14, mb: "4px" }}>
        アプリのリセット
      </Typography>
      <Typography sx={{ fontSize: 11, color: "text.secondary", lineHeight: 1.6, mb: "14px" }}>
        同期やAIコメントが「サーバーに接続できません」で失敗し続けるときに使います。アプリの本体データ(Service
        Workerとキャッシュ)だけを取り直します。<strong>記録・設定は消えません</strong>
      </Typography>

      {status.kind === "confirm" ? (
        <Box sx={{ bgcolor: tokens.warnBg, borderRadius: "11px", p: "12px" }}>
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: "7px" }}>
            <Box sx={{ color: tokens.warnText, display: "flex", mt: "1px" }}>
              <IconWarning />
            </Box>
            <Typography sx={{ fontSize: 11, fontWeight: 500, color: tokens.warnText, lineHeight: 1.5 }}>
              アプリを再読み込みします。未同期の記録は端末に残るため失われません
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: "8px", mt: "10px" }}>
            <Button
              variant="contained"
              color="primary"
              disabled={isResetting}
              onClick={() => void handleReset()}
              sx={{ flex: 1, height: 40, borderRadius: "11px", fontSize: 13, whiteSpace: "nowrap" }}
            >
              {isResetting ? "リセット中..." : "リセットする"}
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              disabled={isResetting}
              onClick={() => setStatus({ kind: "idle" })}
              sx={{ flex: 1, height: 40, borderRadius: "11px", fontSize: 13 }}
            >
              やめる
            </Button>
          </Box>
        </Box>
      ) : (
        <Button
          fullWidth
          variant="outlined"
          color="secondary"
          onClick={() => setStatus({ kind: "confirm" })}
          startIcon={<IconSync />}
          sx={{ height: 46, borderRadius: "13px", fontSize: 14 }}
        >
          アプリをリセットする
        </Button>
      )}

      {status.kind === "error" && (
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: "7px", mt: "12px", bgcolor: tokens.errorBg, borderRadius: "11px", p: "10px 12px" }}>
          <Box sx={{ color: tokens.errorText, display: "flex", mt: "1px" }}>
            <IconWarning />
          </Box>
          <Typography sx={{ fontSize: 11, fontWeight: 500, color: tokens.errorText, lineHeight: 1.5 }}>
            {status.message}。記録は変更されていません
          </Typography>
        </Box>
      )}
    </Card>
  );
}
