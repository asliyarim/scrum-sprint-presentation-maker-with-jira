package com.aksa.capacityplanner.presentation.api.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * Bir donemin kaydedilmis takim sirasi. Donem basina TEK kayit vardir -
 * ikinci kez siralayan oncekinin ustune yazar, updatedBy en son kimin
 * siraladigini soyler (Gözde karari 2026-09-09).
 */
public record PresentationPeriodOrderDto(LocalDate bitis, List<Long> teamIds,
                                          String updatedBy, Instant updatedAt) {
}
