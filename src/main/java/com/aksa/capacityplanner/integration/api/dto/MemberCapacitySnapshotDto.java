package com.aksa.capacityplanner.integration.api.dto;

import java.math.BigDecimal;

/**
 * Kisi bazli kapasite (birim/kumulatiflik icin bkz. CapacityTotalsDto).
 *
 * name          : PO'nun sunumda yazdigi ad (ekrandaki ile ayni).
 * fullName      : takim rosterindaki tam ad (K2) - eslesme yoksa name.
 * jiraAccountId : Jira kalici kullanici kimligi (K2) - rosterde varsa; yoksa null.
 * role          : standartlastirilmis rol (K5): "Geliştirici" / "Analist" /
 *                 ...; PO'nun yazdigi bos/anlamsizsa rosterdaki rol; o da yoksa null.
 * status        : "Uygun"/"Dikkat"/"Risk"/"Yüksek Risk" - ekranla ayni esikler.
 *
 * Ekrandaki "Kişi Bazlı Kapasite Özeti" tablosunun kolon karsiliklari:
 *   Tamamlanan (A/G)     -> completedEffort
 *   Açık İş Yükü (A/G)   -> openEffort
 *   Kapasite (A/G)       -> capacity        (EKIP TOPLAMI satiri da bunun toplami)
 *   Toplam İş Yükü (A/G) -> plannedEffort
 *   Kapasite %           -> occupancyPercent
 *   "(bakım %20)" notu   -> maintenancePercent
 *   Durum                -> status
 */
public record MemberCapacitySnapshotDto(String name, String fullName, String jiraAccountId, String role,
                                          BigDecimal plannedEffort, BigDecimal completedEffort, BigDecimal openEffort,
                                          BigDecimal capacity, BigDecimal maintainedCapacity,
                                          BigDecimal maintenancePercent,
                                          BigDecimal occupancyPercent, String status) {
}
