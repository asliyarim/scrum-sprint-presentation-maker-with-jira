package com.aksa.capacityplanner.integration.api.dto;

import java.math.BigDecimal;

/**
 * Kisi bazli kapasite. Efor/kapasite GUN, occupancyPercent YUZDE; capacity ile
 * maintainedCapacity ayrimi icin bkz. CapacityTotalsDto.
 * status: "Uygun"/"Dikkat"/"Risk"/"Yüksek Risk".
 */
public record MemberCapacitySnapshotDto(String name, String role, BigDecimal plannedEffort,
                                          BigDecimal completedEffort, BigDecimal openEffort,
                                          BigDecimal capacity, BigDecimal maintainedCapacity,
                                          BigDecimal occupancyPercent, String status) {
}
