import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { completeAuthorization } from "@/api/googleOAuth";
import { IconCheck, IconWarning } from "@/components/icons";
import { fontRounded, tokens } from "@/theme";

/**
 * Googleの認可画面から戻ってくる先(Issue #214)。`/oauth/callback`。
 *
 * このパスは Google Cloud Console の「承認済みのリダイレクトURI」に登録した値と一致している必要がある。
 * SPAのため、Cloudflare側は `not_found_handling = "single-page-application"` で
 * どのパスでも index.html を返す(wrangler.toml)。サーバー側のルート追加は不要。
 */
export default function OAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  // Reactの開発時2回マウント(StrictMode)や再レンダリングで、認可コードを二重に交換しないようにする。
  // 認可コードは一度しか使えないため、2回目は必ず失敗して「連携できなかった」に見えてしまう
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    void completeAuthorization(searchParams)
      .then(() => {
        // 履歴に認可コード付きのURLを残さない(戻るボタンで再交換を試みることになるため)
        navigate("/settings", { replace: true });
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Googleとの連携に失敗しました");
      });
  }, [searchParams, navigate]);

  return (
    <Box
      sx={{
        mx: "auto",
        maxWidth: 448,
        px: "20px",
        pt: "80px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "16px",
        textAlign: "center",
      }}
    >
      {error === null ? (
        <>
          <CircularProgress size={28} color="secondary" />
          <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 15 }}>
            Googleと連携しています...
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: "6px", color: tokens.faint }}>
            <IconCheck size={13} />
            <Typography sx={{ fontSize: 11 }}>このまま少しお待ちください</Typography>
          </Box>
        </>
      ) : (
        <>
          <Box sx={{ color: tokens.errorText, display: "flex" }}>
            <IconWarning size={22} />
          </Box>
          <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 15 }}>連携できませんでした</Typography>
          <Typography sx={{ fontSize: 12, color: "text.secondary", lineHeight: 1.7 }}>{error}</Typography>
          <Button
            variant="contained"
            onClick={() => navigate("/settings", { replace: true })}
            sx={{ mt: "8px", height: 44, borderRadius: "13px", fontSize: 13, px: "24px" }}
          >
            設定画面へ戻る
          </Button>
        </>
      )}
    </Box>
  );
}
