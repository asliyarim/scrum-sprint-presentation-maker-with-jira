package com.aksa.capacityplanner.presentation.domain;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SprintPresentation {

    private Long id;
    private Long teamId;
    private String sprintNo;
    private String dateRange;
    /** useSprintForm'un ham state'ini birebir yansitir - bkz. plan dokumani. */
    private Map<String, Object> content;
    private int currentVersion;
    private String updatedBy;
    private Instant createdAt;
    private Instant updatedAt;
    /** PO sunumu "hazir" isaretledigi an; null ise hazir degil. Revizyonda dusmez. */
    private Instant finalizedAt;
    private String finalizedBy;
    /** Sprint doneminin gercek tarihleri (V34) - donem eslestirmesi bunlara gore. */
    private LocalDate periodStart;
    private LocalDate periodEnd;

    /** Ortak sunuma girmeye hazir mi? */
    public boolean isFinalized() {
        return finalizedAt != null;
    }
}
