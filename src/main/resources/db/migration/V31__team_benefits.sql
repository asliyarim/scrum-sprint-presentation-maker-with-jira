-- ============================================================
-- V31 - "Zaman disi kazanimlar" (takim x donem x kazanim turu)
-- ============================================================
-- Dis dashboard (Nezih, gereksinim dokumani 04.09.2026, bolum 3) RPA "Genel
-- Isler" ekranindaki "Zaman Disi Kazanimlar" karti icin kazanim turu bazinda
-- surec sayilarini ister. Uygulamada bu verinin HICBIR kaynagi yoktu (ne
-- Excel'de ne sunum iceriginde) - bu tablo o kaynaktir; PO/admin girer,
-- GET /api/integration/benefits disari verir.
--
-- process_count NULL = bilinmiyor ("veri yok"), 0 = hic surec yok. Ayrim
-- sozlesmenin acik kurali oldugu icin kolon NULLABLE tutulur.
create table team_benefits (
    id             bigserial primary key,
    team_id        bigint       not null references teams(id) on delete cascade,
    period         varchar(20)  not null,
    benefit_key    varchar(40)  not null,
    process_count  integer,
    value          numeric(18,2),
    currency       varchar(3),
    updated_by     varchar(50),
    created_at     timestamptz  not null default now(),
    updated_at     timestamptz  not null default now(),
    constraint uq_team_benefits_team_period_key unique (team_id, period, benefit_key),
    constraint ck_team_benefits_process_count_nonneg check (process_count is null or process_count >= 0)
);

create index ix_team_benefits_team on team_benefits(team_id);
