-- Sprint doneminin GERCEK tarihleri.
--
-- Bugune kadar donem yalnizca serbest metin olarak tutuluyordu
-- (date_range: "10 Temmuz – 24 Temmuz", "27.07.2026 – 06.08.2026", ...).
-- Otomatik ortak sunum ekipleri "ayni donem" olmalarina gore eslestirecegi
-- icin (Gözde karari 2026-09-09) bu bilginin karsilastirilabilir olmasi
-- gerekiyor; ayrica Gözde tarih alaninin takvimden secilmesini onayladi
-- ("3) Tarih alanini takvimden sectirelim mi? olur").
--
-- date_range KALDIRILMAZ: slayt altyazisi, PPTX ciktisi ve sunum listesi hala
-- o metni gosteriyor. Bundan sonra metin, secilen tarihlerden TURETILIR;
-- eski kayitlarda oldugu gibi kalir.
--
-- Kolonlar NULL kabul eder: cevrilemeyen eski kayitlar (varsa) uygulamayi
-- kirmaz, sadece otomatik donem eslestirmesine giremez.
alter table sprint_presentations
    add column period_start date,
    add column period_end date;

comment on column sprint_presentations.period_start is
    'Sprint donemi baslangici. Eski kayitlarda date_range metninden turetildi (bkz. PresentationPeriodBackfill).';
comment on column sprint_presentations.period_end is
    'Sprint donemi bitisi. Donem eslestirmesi BU alana gore yapilir - ekipler sprintlerini ayni gun bitiriyor (ortak demo gunu).';

-- Donem gruplamasi bitis tarihine gore yapiliyor, sorgu deseni bu.
create index ix_sprint_presentations_period_end
    on sprint_presentations (period_end)
    where period_end is not null;

-- Salt-okunur view de yeni kolonlari gostermeli (bkz. V33'teki ayni gerekce).
create or replace view sprint_presentations_readonly as
select id, team_id, sprint_no, date_range, content, current_version, updated_by, created_at, updated_at,
       finalized_at, finalized_by, period_start, period_end
from sprint_presentations;
