package com.aksa.capacityplanner.presentation.api.dto;

import java.time.Instant;
import java.util.Map;

/**
 * Belirli bir surumun TAM hali - meta (surum/kim/ne zaman) + icerik. Liste
 * ucundan (PresentationVersionDto) farki: content'i de tasir. Ortak Sunum
 * ekraninda secilen surumun sunumunu olusturmak icin kullanilir.
 */
public record PresentationVersionDetailDto(int version, Map<String, Object> content, String updatedBy, Instant updatedAt) {
}
