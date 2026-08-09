import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import { getSettings, updateSettings } from "@/db/settings";

export default function InitialSetupPage() {
  const navigate = useNavigate();
  const [goalWeightKg, setGoalWeightKg] = useState("");
  const [goalDate, setGoalDate] = useState("");
  const [dailyCalorieTarget, setDailyCalorieTarget] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkExistingSettings = async () => {
      const settings = await getSettings();
      if (settings.goalWeightKg !== undefined && settings.goalDate !== undefined && settings.dailyCalorieTarget !== undefined) {
        navigate("/");
      }
      setIsLoading(false);
    };
    void checkExistingSettings();
  }, [navigate]);

  const handleSave = async () => {
    setError("");

    if (!goalWeightKg.trim() || !goalDate.trim() || !dailyCalorieTarget.trim()) {
      setError("すべての項目を入力してください");
      return;
    }

    const weight = parseFloat(goalWeightKg);
    const calories = parseInt(dailyCalorieTarget, 10);

    if (isNaN(weight) || weight <= 0) {
      setError("目標体重は正の数値を入力してください");
      return;
    }

    if (!goalDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      setError("目標日はYYYY-MM-DD形式で入力してください");
      return;
    }

    if (isNaN(calories) || calories <= 0) {
      setError("目標カロリーは正の整数を入力してください");
      return;
    }

    try {
      await updateSettings({
        goalWeightKg: weight,
        goalDate,
        dailyCalorieTarget: calories,
      });
      navigate("/");
    } catch (err) {
      setError(`保存に失敗しました: ${err instanceof Error ? err.message : "不明なエラー"}`);
    }
  };

  if (isLoading) {
    return null;
  }

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "background.default", display: "flex", alignItems: "center" }}>
      <Container maxWidth="sm">
        <Stack spacing={3} sx={{ py: 4 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
              目標を設定しましょう
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              減量目標と日々の目標カロリーを入力してください。後から変更できます。
            </Typography>
          </Box>

          {error && <Alert severity="error">{error}</Alert>}

          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 500 }}>
                目標体重(kg)
              </Typography>
              <TextField
                fullWidth
                type="number"
                placeholder="例: 64.5"
                value={goalWeightKg}
                onChange={(e) => setGoalWeightKg(e.target.value)}
              />
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 500 }}>
                目標達成日(YYYY-MM-DD)
              </Typography>
              <TextField
                fullWidth
                type="date"
                value={goalDate}
                onChange={(e) => setGoalDate(e.target.value)}
              />
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 500 }}>
                日々の目標カロリー(kcal)
              </Typography>
              <TextField
                fullWidth
                type="number"
                placeholder="例: 1900"
                value={dailyCalorieTarget}
                onChange={(e) => setDailyCalorieTarget(e.target.value)}
              />
            </Box>
          </Stack>

          <Button variant="contained" size="large" onClick={handleSave} sx={{ mt: 2 }}>
            設定する
          </Button>
        </Stack>
      </Container>
    </Box>
  );
}
