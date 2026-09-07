package com.aksa.capacityplanner.presentation.api.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Kaydedilmis ortak sunum. picks: secilen sunumlarin SIRALI listesi
 * ({presentationId, version, teamId, teamName, sprintNo, dateRange}) - yeniden
 * indirilirken frontend bu listeden icerikleri cekip PPTX'i yeniden uretir.
 */
public record JointPresentationDto(Long id, String title, List<Map<String, Object>> picks,
                                    String createdBy, Instant createdAt) {
}
