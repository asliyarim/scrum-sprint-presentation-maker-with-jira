package com.aksa.capacityplanner.integration.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.math.BigDecimal;

/**
 * Dis sozlesme (bolum 3.2/3.3): processCount null = bilinmiyor, 0 = hic surec
 * yok - bu yuzden processCount HER ZAMAN yazilir (null dahil). value/unit ise
 * yalnizca finansal kazanimda anlamlidir; diger turlerde JSON'a hic yazilmaz.
 */
public record BenefitEntryDto(String key, String label, Integer processCount,
                              @JsonInclude(JsonInclude.Include.NON_NULL) BigDecimal value,
                              @JsonInclude(JsonInclude.Include.NON_NULL) String unit) {
}
