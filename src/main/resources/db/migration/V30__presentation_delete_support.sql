-- ============================================================
-- V30 - Sunum SILME destegi (Sunumlarım'daki "Sil" butonu)
-- ============================================================
-- Kullanici bildirimi 2026-09-01 (Alican Özekinci): "benim board'da Sprint
-- 1-2-3-4-9 bunlari silebilir misin?" - PO'lar yanlislikla olusan/artik
-- gereksiz sunum kartlarini kaldirabilmek istiyor. Eskiden silme ne
-- backend'de ne frontend'de vardi.
--
-- Iki engel vardi, ikisi de burada gideriliyor:

-- 1) sprint_presentation_versions'taki degistirilemezlik trigger'i (V29)
--    hem UPDATE hem DELETE'i engelliyordu. Bir sunum TAMAMEN silinirken
--    surumleri de silinmeli. Trigger artik SADECE UPDATE'i engeller -
--    "surum icerigi degistirilemez (insert-only)" garantisi KORUNUR, ama
--    sunumun komple silinmesine (ve dolayisiyla surumlerinin de gitmesine)
--    izin verilir.
drop trigger if exists trg_presentation_versions_immutable on sprint_presentation_versions;
create trigger trg_presentation_versions_immutable
    before update on sprint_presentation_versions
    for each row execute function trg_presentation_versions_immutable_fn();

-- 2) versions -> presentations foreign key'inde ON DELETE CASCADE yoktu, bu
--    yuzden bir sunum silinemiyordu (surumleri referans veriyordu). Artik
--    sunum silinince surumleri de otomatik silinir - backend tek bir delete
--    ile temiz calisir, yetim surum kalmaz.
alter table sprint_presentation_versions
    drop constraint sprint_presentation_versions_presentation_id_fkey;
alter table sprint_presentation_versions
    add constraint sprint_presentation_versions_presentation_id_fkey
    foreign key (presentation_id) references sprint_presentations(id) on delete cascade;
