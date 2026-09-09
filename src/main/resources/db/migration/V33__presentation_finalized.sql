-- Sunumun "son hale geldi" isareti.
--
-- Otomatik ortak sunum icin gerekli: ortak sunum, bir donemdeki TUM ekipler
-- sunumunu hazir isaretledigi anda olusur (Gözde istegi 2026-09-08: "ekiplerin
-- sunumlari son hale geldiginde bir tetikleme olmali ve tum ekipler
-- tamamladiginda ancak admin ekraninda birlesmis hali otomatik gelmelidir").
--
-- Iki kolon da NULL kabul eder ve varsayilani yoktur: mevcut satirlar
-- oldugu gibi kalir (finalized_at IS NULL = henuz hazir degil), hicbir sorgu
-- ya da ekran bundan etkilenmez.
--
-- ONEMLI - isaret REVIZYONDA DUSMEZ: PO sunumu hazir isaretledikten sonra
-- icerigini guncellerse isaret KORUNUR ve ortak sunum yeni icerigi gosterir
-- (Gözde karari 2026-09-09: "otomatik guncellensin, Cagdas Bey surekli hangisi
-- yeni versiyon diye aramak zorunda kalmasin, direkt ilgili tarihin son
-- sunumunu gorsun"). Isaret yalnizca PO acikca geri alirsa duser.
alter table sprint_presentations
    add column finalized_at timestamptz,
    add column finalized_by varchar(50);

comment on column sprint_presentations.finalized_at is
    'PO sunumu "hazir" olarak isaretledigi an; NULL ise henuz hazir degil. Revizyonda dusmez.';
comment on column sprint_presentations.finalized_by is
    'Hazir isaretini koyan kullanicinin sicili.';

-- Hazir sunumlari donem bazinda tararken kullanilir; kismi indeks, cunku
-- sorgular her zaman "hazir olanlar" tarafina bakar.
create index ix_sprint_presentations_finalized
    on sprint_presentations (finalized_at)
    where finalized_at is not null;

-- Salt-okunur view (V5) de yeni kolonlari gostermeli. Ortak sunum ekrani
-- takimlarin sunumlarini BU view uzerinden okuyor (findLatestPerTeamReadOnly);
-- kolonlar eklenmezse "hazir mi?" bilgisi orada sessizce bos gorunurdu.
-- create or replace: PostgreSQL mevcut kolonlarin adi/tipi/sirasi degismedigi
-- ve yeni kolonlar SONA eklendigi surece buna izin verir.
create or replace view sprint_presentations_readonly as
select id, team_id, sprint_no, date_range, content, current_version, updated_by, created_at, updated_at,
       finalized_at, finalized_by
from sprint_presentations;
