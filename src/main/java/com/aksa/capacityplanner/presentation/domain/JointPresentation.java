package com.aksa.capacityplanner.presentation.domain;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Kaydedilmis ORTAK (coklu takim) sunum - Cagdas Bey istegi 2026-09-07:
 * ortaklastirilmis sunumlar admin panelinde tarih tarih gorulebilsin.
 *
 * picks: secilen sunumlarin SIRALI listesi; her ogede presentationId + version
 * (ve gosterim icin teamName/sprintNo/dateRange) bulunur. Sunum ICERIGI burada
 * tutulmaz - yeniden indirilirken versions tablosundan okunup PPTX aynen
 * yeniden uretilir (bkz. V32 migration notu).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class JointPresentation {

    private Long id;
    private String title;
    private List<Map<String, Object>> picks;
    private String createdBy;
    private Instant createdAt;
}
