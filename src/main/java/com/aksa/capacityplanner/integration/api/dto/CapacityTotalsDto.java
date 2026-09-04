package com.aksa.capacityplanner.integration.api.dto;

import java.math.BigDecimal;

/**
 * Takim geneli kapasite ozeti. Birim: GUN (bkz. TeamCapacitySnapshotDto.unit).
 *
 * plannedEffort/completedEffort/openEffort KUMULATIFTIR: sprintin kendi isi
 * degil, kapasite doneminin (capacityPeriod) basindan beri birikmis toplam.
 * capacity = donem sonuna kalan ham is gunu; maintainedCapacity = bakim/SR
 * payi dusulmus hali. occupancyPercent 0-100 olcegindedir (165.95 = %165,95)
 * ve her ekibin kendi Excel raporundan gelir - dashboard yeniden HESAPLAMAZ,
 * oldugu gibi gosterir (sozlesme temel ilkesi).
 *
 * fte                 : "Is Yuku FTE" (K4) - yalnizca FTE takibi olan takimda
 *                       (RPA) dolu, digerlerinde null.
 * reported*           : PO'nun forma KENDI girdigi donem degerleri (Yeni
 *                       Eklenen / Donem Kapanan / Net Degisim) - turetilmis
 *                       degil, beyan edilmis; girilmediyse null.
 */
public record CapacityTotalsDto(BigDecimal plannedEffort, BigDecimal completedEffort, BigDecimal openEffort,
                                 BigDecimal capacity, BigDecimal maintainedCapacity,
                                 BigDecimal occupancyPercent, BigDecimal capacityGap,
                                 String status, BigDecimal fte,
                                 BigDecimal reportedClosedEffort, BigDecimal reportedAddedEffort,
                                 BigDecimal reportedNetChange) {
}
