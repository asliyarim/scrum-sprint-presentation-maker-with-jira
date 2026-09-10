-- Bir DONEMIN takim sirasi - ortak sunumda slaytlarin hangi sirayla gelecegi.
--
-- Gözde'nin 4. maddesi (2026-09-09): "sıralamayı biz manuel yapabilir miyiz...
-- kim sıralama yaptıysa o şekilde sonlansın." Yani sira elle degistirilebilmeli
-- ve EN SON kim degistirdiyse onunki gecerli olmali.
--
-- NEDEN AYRI TABLO: otomatik ortak sunum bir KAYIT degil, donemden hesaplanan
-- canli bir birlesim (bkz. JointPresentationListPanel.donemdenOtomatikSunum) -
-- boylece bir ekip revize ettiginde kendiliginden guncelleniyor. Sirayi
-- joint_presentations'a yazsaydik, o kaydin dondurulmus dogasi yuzunden ya
-- sirayi da dondurmus ya da o kaydi surekli yeniden yazmak zorunda kalmis
-- olurduk. Sira, icerikten BAGIMSIZ ve donem basina TEK bir bilgi; kendi
-- tablosunda durmasi hem sade hem de mevcut hicbir seyi etkilemiyor.
--
-- period_end birincil anahtar: her donemin tek bir sirasi vardir, ikinci kez
-- siralama yapan ustune yazar - "son siralayan kazanir" kurali tam olarak bu.
create table if not exists period_team_order (
    period_end date primary key,
    team_ids   jsonb       not null,
    updated_by varchar(50),
    updated_at timestamptz not null default now()
);

comment on table period_team_order is
    'Donem basina takim sirasi (ortak sunumdaki slayt sirasi). Son yazan kazanir - bkz. Gözde karari 2026-09-09.';
comment on column period_team_order.period_end is
    'Donemi temsil eden bitis tarihi - PeriodGrouper.Donem.bitis ile ayni deger.';
comment on column period_team_order.team_ids is
    'Takim id''lerinin SIRALI JSON dizisi, orn: [2,1,5,3]. Listede olmayan takimlar sona, kendi varsayilan siralarinda eklenir.';
comment on column period_team_order.updated_by is
    'Sirayi en son degistiren kullanicinin sicili.';
