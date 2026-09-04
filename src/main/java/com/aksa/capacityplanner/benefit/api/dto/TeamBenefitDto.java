package com.aksa.capacityplanner.benefit.api.dto;

import java.math.BigDecimal;
import java.time.Instant;

/** Uygulama ici (cookie oturumlu) kazanim kaydi gorunumu. */
public record TeamBenefitDto(Long id, Long teamId, String period, String key, String label,
                             Integer processCount, BigDecimal value, String currency,
                             String updatedBy, Instant updatedAt) {
}
