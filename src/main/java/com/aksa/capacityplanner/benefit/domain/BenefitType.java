package com.aksa.capacityplanner.benefit.domain;

import java.util.Arrays;
import java.util.Locale;
import java.util.Optional;

/**
 * "Zaman disi kazanim" turleri - RPA "Genel Isler" ekranindaki kart icin.
 * key/label degerleri dis dashboard sozlesmesiyle (Nezih, gereksinim dokumani
 * 04.09.2026, bolum 3.3) BIREBIR aynidir; ekranda ikon/renk key'e gore secilir.
 * Bildirim sirasi (declaration order) ekranda korunur - en fazla 6 tur.
 */
public enum BenefitType {
    FINANCIAL("financial", "Finansal Kazanç"),
    ERROR_REDUCTION("errorReduction", "Hata Azaltma"),
    RISK_CONTROL("riskControl", "Risk ve Kontrol"),
    EMPLOYEE_EXPERIENCE("employeeExperience", "Çalışan Deneyimi"),
    CUSTOMER_EXPERIENCE("customerExperience", "Müşteri Deneyimi"),
    DATA_QUALITY("dataQuality", "Veri Kalitesi");

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
        return this == FINANCIAL;
    }

    /** Dis sozlesmedeki key'den ("errorReduction") ya da enum adindan cozer. */
    public static Optional<BenefitType> fromKey(String raw) {
        if (raw == null || raw.isBlank()) {
            return Optional.empty();
        }
        String k = raw.trim();
        String compact = k.replace("_", "").toUpperCase(Locale.ROOT);
        return Arrays.stream(values())
                .filter(t -> t.key.equalsIgnoreCase(k)
                        || t.name().equalsIgnoreCase(k)
                        || t.name().replace("_", "").equals(compact))
                .findFirst();
    }
}
