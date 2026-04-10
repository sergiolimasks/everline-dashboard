-- 004: fix broken `views_pagina` values for 2026-04-02..2026-04-08.
-- The Meta pixel was dropping PageView events during that window, so the raw
-- `views_pagina` numbers don't reflect actual landing-page traffic. Checkouts,
-- purchases and spend were unaffected (other pixel events kept firing).
--
-- Strategy: replace each row's views_pagina with an estimate derived from the
-- 7-day baseline ratio views_pagina / cliques_link (2026-03-26..2026-04-01 =
-- ~0.83 in the raw data). Applied per row so campaigns/ads keep proportional
-- traffic. All downstream metrics in the dashboard are computed on the fly from
-- this column, so fixing it here cascades automatically to the UI.
--
-- Every row touched gets backed up to bd_ads_clientes.views_pagina_fix_log so
-- the fix is fully reversible and the migration is safe to re-run.

-- 1. Backup table (idempotent).
CREATE TABLE IF NOT EXISTS bd_ads_clientes.views_pagina_fix_log (
  row_id              bigint PRIMARY KEY,
  data                date NOT NULL,
  anuncio_id          text,
  cliques_link        integer,
  views_pagina_before integer,
  views_pagina_after  integer,
  baseline_ratio      numeric(8,4),
  fixed_at            timestamptz NOT NULL DEFAULT now()
);

-- 2. Compute the baseline ratio from the 7 days immediately preceding the
--    broken window (inclusive).
DO $$
DECLARE
  baseline_ratio numeric(8,4);
  rows_fixed     integer := 0;
BEGIN
  SELECT ROUND(
    SUM(views_pagina)::numeric / NULLIF(SUM(cliques_link), 0)::numeric,
    4
  )
  INTO baseline_ratio
  FROM bd_ads_clientes.meta_uelicon_venancio
  WHERE data BETWEEN '2026-03-26' AND '2026-04-01';

  IF baseline_ratio IS NULL OR baseline_ratio = 0 THEN
    RAISE EXCEPTION 'baseline ratio is null or zero — aborting fix';
  END IF;

  RAISE NOTICE 'baseline views_pagina/cliques_link ratio: %', baseline_ratio;

  -- 3. Back up rows in the broken window that aren't logged yet.
  INSERT INTO bd_ads_clientes.views_pagina_fix_log
    (row_id, data, anuncio_id, cliques_link, views_pagina_before, views_pagina_after, baseline_ratio)
  SELECT
    m.id,
    m.data,
    m.anuncio_id,
    m.cliques_link,
    m.views_pagina,
    GREATEST(ROUND(m.cliques_link * baseline_ratio)::int, 0),
    baseline_ratio
  FROM bd_ads_clientes.meta_uelicon_venancio m
  WHERE m.data BETWEEN '2026-04-02' AND '2026-04-08'
    AND NOT EXISTS (
      SELECT 1 FROM bd_ads_clientes.views_pagina_fix_log l WHERE l.row_id = m.id
    );

  -- 4. Apply the fix only on rows that are still at their original broken
  --    value. Re-runs are no-ops because the log's before/after comparison
  --    already accounts for the current state.
  WITH fix AS (
    SELECT l.row_id, l.views_pagina_after
    FROM bd_ads_clientes.views_pagina_fix_log l
    JOIN bd_ads_clientes.meta_uelicon_venancio m ON m.id = l.row_id
    WHERE m.views_pagina = l.views_pagina_before
      AND m.views_pagina <> l.views_pagina_after
  )
  UPDATE bd_ads_clientes.meta_uelicon_venancio m
     SET views_pagina = fix.views_pagina_after
    FROM fix
   WHERE m.id = fix.row_id;

  GET DIAGNOSTICS rows_fixed = ROW_COUNT;
  RAISE NOTICE 'rows fixed: %', rows_fixed;
END $$;
