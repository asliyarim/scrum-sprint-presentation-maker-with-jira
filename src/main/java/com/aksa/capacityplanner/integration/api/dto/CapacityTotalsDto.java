package com.aksa.capacityplanner.integration.api.dto;

import java.math.BigDecimal;

/**
 * Takim geneli kapasite ozeti.
 *
 * Efor/kapasite alanlari GUN cinsindendir. occupancyPercent YUZDEDIR (orn.
 * 159.00 = %159) - kayitta oran olarak (1.59) durdugu icin 100 ile carpilarak
 * verilir, cagiran tarafta birim karisikligi olmasin.
 *
 * Kapasite IKI alan halinde verilir, cunku doluluk HAM kapasiteye degil BAKIM
 * HARIC kapasiteye gore hesaplanir:
 *   capacity            - ham kalan kapasite
 *   maintainedCapacity  - bakim/SR payi dusulmus kapasite (dolulugun PAYDASI)
 * Yani occupancyPercent ~= openEffort / maintainedCapacity * 100. Tek bir
 * "capacity" alani verilseydi cagiran taraf yuzdeyi tutturamazdi.
 */
public record CapacityTotalsDto(BigDecimal plannedEffort, BigDecimal completedEffort, BigDecimal openEffort,
                                 BigDecimal capacity, BigDecimal maintainedCapacity,
                                 BigDecimal occupancyPercent, BigDecimal capacityGap,
                                 String status) {
}
