-- "Zaman disi fayda" kategorileri ALTIDAN BESE indi (Pelinsu listesi,
-- kullanici karari 2026-09-10). Bu bir yeniden adlandirma degil, birlesme:
--
--   ERROR_REDUCTION + DATA_QUALITY          -> KALITE_DOGRULUK_SUREKLILIK
--   EMPLOYEE_EXPERIENCE + CUSTOMER_EXPERIENCE -> CALISAN_MUSTERI_DENEYIMI
--   RISK_CONTROL                            -> RISK_UYUM_DENETIM
--   FINANCIAL                               -> FINANSAL_KAZANIM
--   (karsiligi yok)                         -> OPERASYONEL_VERIMLILIK  [YENI]
--
-- benefit_key varchar oldugundan (Postgres enum degil) tip degisikligi
-- gerekmiyor; yalnizca degerler cevriliyor. Enum artik eski adlari
-- tanimadigi icin bu migration OLMADAN eski satirlar okunamaz - bu yuzden
-- kod degisikligiyle AYNI surumde gitmeli.
--
-- BIRLESME VE BENZERSIZLIK: (team_id, period, benefit_key) benzersiz. Iki
-- eski tur ayni yeni ture dusunce cakisirlar, bu yuzden once TOPLANIP tek
-- satira indiriliyorlar. process_count'lar toplaniyor: ikisi de "kazanim
-- saglanan surec sayisi" oldugundan toplam anlamli. Ikisi de NULL ise
-- ("bilinmiyor") sonuc yine NULL kalir - "bilinmiyor" ile 0 farki dis
-- sozlesmenin acik kurali.
--
-- NOT: ayni surec hem hata azaltma hem veri kalitesi sagladiysa toplamda IKI
-- kez sayilmis olur. Kayit sayisi az oldugu icin bilerek kabul edildi; RPA
-- PO'su yeni ekrandan sayilari gozden gecirip duzeltebilir.

-- 1) Cakisacak turleri once tek satirda topla.
with birlesenler as (
    select team_id,
           period,
           case
               when benefit_key in ('ERROR_REDUCTION', 'DATA_QUALITY') then 'KALITE_DOGRULUK_SUREKLILIK'
               else 'CALISAN_MUSTERI_DENEYIMI'
           end                                              as yeni_key,
           min(id)                                          as tutulacak_id,
           case when count(*) filter (where process_count is not null) = 0
                then null
                else sum(process_count)
           end                                              as toplam_surec,
           case when count(*) filter (where value is not null) = 0
                then null
                else sum(value)
           end                                              as toplam_deger,
           max(currency)                                    as para_birimi
    from team_benefits
    where benefit_key in ('ERROR_REDUCTION', 'DATA_QUALITY',
                          'EMPLOYEE_EXPERIENCE', 'CUSTOMER_EXPERIENCE')
    group by team_id, period,
             case
                 when benefit_key in ('ERROR_REDUCTION', 'DATA_QUALITY') then 'KALITE_DOGRULUK_SUREKLILIK'
                 else 'CALISAN_MUSTERI_DENEYIMI'
             end
)
update team_benefits t
set benefit_key   = b.yeni_key,
    process_count = b.toplam_surec,
    value         = b.toplam_deger,
    currency      = b.para_birimi,
    updated_at    = now()
from birlesenler b
where t.id = b.tutulacak_id;

-- 2) Toplama sonrasi artik gereksiz kalan (ayni gruptan ikinci) satirlari sil.
delete from team_benefits
where benefit_key in ('ERROR_REDUCTION', 'DATA_QUALITY',
                      'EMPLOYEE_EXPERIENCE', 'CUSTOMER_EXPERIENCE');

-- 3) Birebir karsiligi olan turler - cakisma riski yok.
update team_benefits set benefit_key = 'RISK_UYUM_DENETIM', updated_at = now()
where benefit_key = 'RISK_CONTROL';

update team_benefits set benefit_key = 'FINANSAL_KAZANIM', updated_at = now()
where benefit_key = 'FINANCIAL';

comment on column team_benefits.benefit_key is
    'Zaman disi fayda turu (BenefitType enum adi). 2026-09-10''da alti turden bese indirildi - bkz. V36.';
