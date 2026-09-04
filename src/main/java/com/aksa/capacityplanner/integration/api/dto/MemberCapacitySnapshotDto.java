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
 */
public record MemberCapacitySnapshotDto(String name, String fullName, String jiraAccountId, String role,
                                          BigDecimal plannedEffort, BigDecimal completedEffort, BigDecimal openEffort,
                                          BigDecimal capacity, BigDecimal maintainedCapacity,
                                          BigDecimal occupancyPercent, String status) {
}
