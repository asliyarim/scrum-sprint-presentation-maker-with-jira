package com.aksa.capacityplanner.presentation.domain;

import java.time.LocalDate;

/**
 * Bir sprintin tarih araligi (baslangic-bitis, ikisi de dahil).
 *
 * Sunumlarda bu bilgi SERBEST METIN olarak tutuluyor (sprint_presentations.
 * date_range) ve ekipler farkli bicimler kullaniyor: "10 Temmuz – 24 Temmuz",
 * "3 Haziran - 18 Haziran", "27.07.2026 – 06.08.2026". Otomatik ortak sunum
 * icin bu metni gercek tarihlere cevirmek gerekiyor - bkz. SprintPeriodParser.
 */
public record SprintPeriod(LocalDate start, LocalDate end) {

    public SprintPeriod {
        if (start == null || end == null) {
            throw new IllegalArgumentException("SprintPeriod baslangic ve bitis tarihi zorunlu.");
        }
        if (end.isBefore(start)) {
            throw new IllegalArgumentException("SprintPeriod bitisi baslangictan once olamaz: " + start + " - " + end);
        }
    }

    /**
     * Iki donem AYNI doneme mi sayilir?
     *
     * Gözde'nin karari (2026-09-09): tarihler birebir tutmasa da cakisiyorlarsa
     * ayni doneme sayilir ("aynı döneme sayalım"). Ekipler sprintlerini birkac
     * gun kaydirarak planlayabiliyor (orn. biri 24.07-03.08, digeri 27.07-10.08)
     * ama ayni sunum turunde birlestiriliyorlar.
     *
     * Kapali aralik: uc noktalarin degmesi de cakisma sayilir.
     */
    public boolean overlaps(SprintPeriod other) {
        return other != null && !start.isAfter(other.end) && !other.start.isAfter(end);
    }

    /** Iki donemi tek bir donemde birlestirir (en erken baslangic, en gec bitis). */
    public SprintPeriod merge(SprintPeriod other) {
        if (other == null) {
            return this;
        }
        return new SprintPeriod(
                start.isBefore(other.start) ? start : other.start,
                end.isAfter(other.end) ? end : other.end);
    }

    public int lengthInDays() {
        return (int) (end.toEpochDay() - start.toEpochDay()) + 1;
    }
}
