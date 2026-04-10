-- 005: fix broken `views_pagina` for 2026-03-19 (same pattern as migration 004).
-- On that day the Meta pixel dropped ~80% of PageView events (ratio fell from
-- ~0.79 to 0.17). Surrounding days (12–18 Mar, 20 Mar) look clean, so we use
-- the 7 days immediately preceding the outage as baseline.
--
-- Reuses the bd_ads_clientes.views_pagina_fix_log table from migration 004 for
-- audit/backup — same reversibility guarantees.

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
  WHERE data BETWEEN '2026-03-12' AND '2026-03-18';

  IF baseline_ratio IS NULL OR baseline_ratio = 0 THEN
    RAISE EXCEPTION 'baseline ratio is null or zero — aborting fix';
  END IF;

  RAISE NOTICE 'baseline views_pagina/cliques_link ratio (Mar 12-18): %', baseline_ratio;

  -- Back up the broken rows (idempotent).
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
  WHERE m.data = '2026-03-19'
    AND NOT EXISTS (
      SELECT 1 FROM bd_ads_clientes.views_pagina_fix_log l WHERE l.row_id = m.id
    );

  -- Apply the fix only on rows still at their original broken value.
  WITH fix AS (
    SELECT l.row_id, l.views_pagina_after
    FROM bd_ads_clientes.views_pagina_fix_log l
    JOIN bd_ads_clientes.meta_uelicon_venancio m ON m.id = l.row_id
    WHERE l.data = '2026-03-19'
      AND m.views_pagina = l.views_pagina_before
      AND m.views_pagina <> l.views_pagina_after
  )
  UPDATE bd_ads_clientes.meta_uelicon_venancio m
     SET views_pagina = fix.views_pagina_after
    FROM fix
   WHERE m.id = fix.row_id;

  GET DIAGNOSTICS rows_fixed = ROW_COUNT;
  RAISE NOTICE 'rows fixed: %', rows_fixed;
END $$;
