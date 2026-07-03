-- Adds an optional "alt_materials" column to quote_materials and sales_job_materials.
-- Lets one material line list other interchangeable material names (e.g. "Fill Dirt"
-- line can note "A-3 Fill" as also acceptable) without splitting into a second priced
-- line. Purely a display label — pricing/qty still comes from the single selected
-- `material` on that line. Safe to run on the live DB: nullable, no default, no
-- existing rows touched.

alter table quote_materials add column if not exists alt_materials text;
alter table sales_job_materials add column if not exists alt_materials text;
