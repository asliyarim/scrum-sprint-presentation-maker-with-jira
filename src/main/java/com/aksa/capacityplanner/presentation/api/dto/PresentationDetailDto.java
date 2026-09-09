package com.aksa.capacityplanner.presentation.api.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;

public record PresentationDetailDto(Long id, Long teamId, String sprintNo, String dateRange,
                                     Map<String, Object> content, int currentVersion,
                                     String updatedBy, Instant updatedAt,
                                     /** Ortak sunuma hazir isaretlendigi an; null ise hazir degil. */
                                     Instant finalizedAt, String finalizedBy,
                                     LocalDate periodStart, LocalDate periodEnd) {
}
