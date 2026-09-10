package com.aksa.capacityplanner.benefit.domain;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Bir takimin, bir DONEM icin ("2026", "2026-Q3"), bir kazanim turundeki
 * degeri. (teamId, period, type) benzersizdir - ayni tur icin yeni deger
 * girilince ustune yazilir, gecmis donemler ayri kayit olarak kalir.
 *
 * processCount: kazanim saglanan surec sayisi. null = BILINMIYOR (ekranda
 * "veri yok"), 0 = hic surec yok (ekranda 0). Bu ayrim dis sozlesmenin
 * acik kurali (bolum 3.4), o yuzden Integer (ilkel int degil).
 * value/currency: yalnizca FINANSAL_KAZANIM turunde anlamlidir.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TeamBenefit {

    private Long id;
    private Long teamId;
    private String period;
    private BenefitType type;
    private Integer processCount;
    private BigDecimal value;
    private String currency;
    private String updatedBy;
    private Instant updatedAt;
}
