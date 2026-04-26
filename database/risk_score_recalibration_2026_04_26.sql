-- Recalibrate risk_score_history from the old "higher is safer" score
-- to the new "higher is riskier" score.
--
-- New weights:
--   vessel 40 + geopolitical 30 + Brent 20 + VIX 10 = 100
--
-- This migration uses stored component scores, so historical Brent scores
-- reflect the price-level signal only. The 7-day Brent surge signal is applied
-- by the application from the next risk score save onward.

WITH recalculated AS (
  SELECT
    score_date,
    CASE WHEN vessel_score IS NULL THEN NULL ELSE 40 - vessel_score END AS new_vessel_score,
    CASE WHEN geo_score    IS NULL THEN NULL ELSE 30 - geo_score END AS new_geo_score,
    CASE WHEN brent_score  IS NULL THEN NULL ELSE ((15 - brent_score) / 15) * 20 END AS new_brent_score,
    CASE WHEN vix_score    IS NULL THEN NULL ELSE ((15 - vix_score) / 15) * 10 END AS new_vix_score,
    CASE
      WHEN geo_score IS NULL THEN 100 - total_score
      ELSE
        COALESCE(40 - vessel_score, 20)
        + COALESCE(30 - geo_score, 15)
        + COALESCE(((15 - brent_score) / 15) * 20, 10)
        + COALESCE(((15 - vix_score) / 15) * 10, 5)
    END AS new_total_score
  FROM risk_score_history
)
UPDATE risk_score_history r
SET
  vessel_score = ROUND(recalculated.new_vessel_score, 1),
  geo_score    = ROUND(recalculated.new_geo_score, 1),
  brent_score  = ROUND(recalculated.new_brent_score, 1),
  vix_score    = ROUND(recalculated.new_vix_score, 1),
  total_score  = ROUND(LEAST(GREATEST(recalculated.new_total_score, 0), 100), 1),
  updated_at   = NOW()
FROM recalculated
WHERE r.score_date = recalculated.score_date;
