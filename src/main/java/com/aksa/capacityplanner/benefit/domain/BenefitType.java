package com.aksa.capacityplanner.benefit.domain;

import java.util.Arrays;
import java.util.Locale;
import java.util.Optional;

/**
 * "Zaman disi fayda" turleri - RPA sunumunda PO'nun elle girdigi kazanim
 * sayilari. key/label degerleri dis dashboard sozlesmesinde (Nezih) gorunur;
 * bildirim sirasi (declaration order) ekranda korunur.
 *
 * 2026-09-10'DA DEGISTI - ONEMLI: onceki alti tur (financial, errorReduction,
 * riskControl, employeeExperience, customerExperience, dataQuality) yerini
 * Pelinsu'nun paylastigi BES basliga birakti. Bu bir isim degisikligi degil,
 * kategori birlesmesi:
 *
 *   Veri Kalitesi + Hata Azaltma        -> Kalite, Doğruluk ve Süreklilik
 *   Calisan Deneyimi + Musteri Deneyimi -> Çalışan ve Müşteri Deneyimi
 *   Risk ve Kontrol                     -> Risk, Uyum ve Denetim
 *   Finansal Kazanc                     -> Finansal Kazanım
 *   (karsiligi yok)                     -> Operasyonel Verimlilik  [YENI]
 *
 * Bu degisiklik DIS SOZLESMEYI KIRAR: Nezih'in panosu eski key'leri okuyordu,
 * yeni key'lere gecmesi gerekiyor (kullanici karari 2026-09-10, secenek A -
 * eski key'leri korumak mumkun degildi cunku kategori SAYISI da degisti).
 * Mevcut kayitlar V36__benefit_categories.sql ile yeni turlere tasindi;
 * birlesen turlerin surec sayilari TOPLANDI.
 */
public enum BenefitType {
    KALITE_DOGRULUK_SUREKLILIK("kaliteDogrulukSureklilik", "Kalite, Doğruluk ve Süreklilik"),
    OPERASYONEL_VERIMLILIK("operasyonelVerimlilik", "Operasyonel Verimlilik"),
    RISK_UYUM_DENETIM("riskUyumDenetim", "Risk, Uyum ve Denetim"),
    CALISAN_MUSTERI_DENEYIMI("calisanMusteriDeneyimi", "Çalışan ve Müşteri Deneyimi"),
    FINANSAL_KAZANIM("finansalKazanim", "Finansal Kazanım");

    private final String key;
    private final String label;

    BenefitType(String key, String label) {
        this.key = key;
        this.label = label;
    }

    public String key() {
        return key;
    }

    public String label() {
        return label;
    }

    /** Yalnizca finansal kazanimda toplam deger + para birimi tasinir. */
    public boolean carriesValue() {
        return this == FINANSAL_KAZANIM;
    }

    /**
     * Dis sozlesmedeki key'den ("riskUyumDenetim") ya da enum adindan cozer.
     *
     * ESKI KEY'LER DE KABUL EDILIR: Nezih'in panosu ve elde kalmis eski
     * istekler bir sure daha eski adlari gonderebilir; sessizce reddetmek
     * yerine yeni karsiliklarina yonlendiriyoruz (bkz. eskiden yeniye
     * esleme, V36 migration'iyla ayni). Boylece gecis suresince iki taraf da
     * calisir.
     */
    public static Optional<BenefitType> fromKey(String raw) {
        if (raw == null || raw.isBlank()) {
            return Optional.empty();
        }
        String k = raw.trim();
        Optional<BenefitType> eski = eskiKeyden(k);
        if (eski.isPresent()) {
            return eski;
        }
        String compact = k.replace("_", "").toUpperCase(Locale.ROOT);
        return Arrays.stream(values())
                .filter(t -> t.key.equalsIgnoreCase(k)
                        || t.name().equalsIgnoreCase(k)
                        || t.name().replace("_", "").equals(compact))
                .findFirst();
    }

    /** 2026-09-10 oncesi adlar - hem key hem enum adi bicimiyle. */
    private static Optional<BenefitType> eskiKeyden(String k) {
        return switch (k.toUpperCase(Locale.ROOT)) {
            case "FINANCIAL" -> Optional.of(FINANSAL_KAZANIM);
            case "ERRORREDUCTION", "ERROR_REDUCTION", "DATAQUALITY", "DATA_QUALITY" ->
                    Optional.of(KALITE_DOGRULUK_SUREKLILIK);
            case "RISKCONTROL", "RISK_CONTROL" -> Optional.of(RISK_UYUM_DENETIM);
            case "EMPLOYEEEXPERIENCE", "EMPLOYEE_EXPERIENCE", "CUSTOMEREXPERIENCE", "CUSTOMER_EXPERIENCE" ->
                    Optional.of(CALISAN_MUSTERI_DENEYIMI);
            default -> Optional.empty();
        };
    }
}
