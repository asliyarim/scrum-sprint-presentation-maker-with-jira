package com.aksa.capacityplanner.presentation.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.Map;

/**
 * id: DUZENLENEN mevcut sunumun kimligi (opsiyonel). Verilirse "bu kaydi
 * guncelle" (sprint no degistiyse RENAME) anlamina gelir - yeni bir kart
 * olusmaz. Bos ise eski davranis: (teamId, sprintNo) ile bulunur/olusturulur.
 * Kullanici bildirimi 2026-09-01: sprint no degistirip kaydedince yeni kart
 * cikip "cokluyordu".
 */
public record PresentationUpsertRequest(Long id, @NotNull Long teamId, @NotBlank String sprintNo, String dateRange,
                                         @NotNull Map<String, Object> content) {
}
