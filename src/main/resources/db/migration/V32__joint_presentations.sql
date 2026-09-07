-- ============================================================
-- V32 - Kaydedilmis ORTAK (coklu takim) sunumlar
-- ============================================================
-- Cagdas Bey istegi (Gözde uzerinden, 2026-09-07): "admin panelinde sunumlari
-- ortaklastirdigimda ortaklasmis halini tarih tarih gormek istiyorum".
-- Eskiden ortak sunum yalnizca uretilip indiriliyordu; hangi tarihte hangi
-- takimlarin hangi SURUMLERI birlestirilmisti hicbir yerde durmuyordu.
--
-- picks: secilen sunumlarin SIRALI listesi -
--   [{ "presentationId": 31, "version": 3, "teamId": 2, "teamName": "...",
--      "sprintNo": "5", "dateRange": "..." }]
-- Sunum ICERIGI burada TEKRARLANMAZ; yeniden indirilirken her (presentationId,
-- version) ciftinin icerigi sprint_presentation_versions'tan okunur ve ayni
-- jointDeckBuilder ile PPTX yeniden uretilir. Boylece hem depolama kucuk
-- kalir hem de surum gecmisi tek kaynakta (versions tablosu) tutulur.
create table joint_presentations (
    id          bigserial    primary key,
    title       varchar(200) not null,
    picks       jsonb        not null,
    created_by  varchar(50),
    created_at  timestamptz  not null default now(),
    constraint ck_joint_presentations_picks_array check (jsonb_typeof(picks) = 'array')
);

create index idx_joint_presentations_created_at on joint_presentations(created_at desc);
