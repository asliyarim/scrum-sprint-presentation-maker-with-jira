package com.aksa.capacityplanner.presentation.api.dto;

import java.time.Instant;
import java.time.LocalDate;

public record PresentationSummaryDto(Long id, Long teamId, String sprintNo, String dateRange,
                                      int currentVersion, String updatedBy, Instant updatedAt,
                                      /** Ortak sunuma hazir isaretlendigi an; null ise hazir degil. */
                                      Instant finalizedAt, String finalizedBy,
                                      /** Sprint doneminin gercek tarihleri (V34); cevrilemeyen eski kayitlarda null. */
                                      LocalDate periodStart, LocalDate periodEnd) {
}
