package com.aksa.capacityplanner.integration.usecase;

import com.aksa.capacityplanner.benefit.domain.BenefitType;
import com.aksa.capacityplanner.benefit.domain.TeamBenefit;
import com.aksa.capacityplanner.integration.api.dto.BenefitEntryDto;
import com.aksa.capacityplanner.integration.api.dto.TeamBenefitsSnapshotDto;
import com.aksa.capacityplanner.team.domain.Team;

import java.time.Instant;
import java.util.Arrays;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Saf donusum (Spring/DB yok) - birim testte dogrudan cagrilir.
 *
 * Takimin kayitlari arasindan EN SON GUNCELLENEN donem secilir; o donemde
 * girilmemis turler processCount=null ile listede yine yer alir (ekranda
 * "veri yok"). Sira BenefitType bildirim sirasidir, hep 6 satir.
 */
public final class BenefitsSnapshotMapper {

    public static final int API_VERSION = 1;

    private BenefitsSnapshotMapper() {
    }

    public static TeamBenefitsSnapshotDto toSnapshot(Team team, List<TeamBenefit> rows) {
        String projectKey = ProjectKeys.resolve(team);
        List<TeamBenefit> safe = rows == null ? List.of() : rows.stream()
                .filter(r -> r != null && r.getPeriod() != null && r.getType() != null)
                .toList();
        if (safe.isEmpty()) {
            return new TeamBenefitsSnapshotDto(API_VERSION, projectKey, team.getId(), team.getName(),
                    null, null, List.of());
        }

        // Donem secimi: en yeni updatedAt; esitlikte sozluksel en buyuk donem
        // ("2026-Q3" > "2026-Q2"). null updatedAt en dusuk oncelik.
        Comparator<TeamBenefit> byUpdated = Comparator.comparing(TeamBenefit::getUpdatedAt,
                Comparator.nullsFirst(Instant::compareTo));
        String period = safe.stream()
                .max(byUpdated.thenComparing(TeamBenefit::getPeriod))
                .map(TeamBenefit::getPeriod)
                .orElseThrow();

        Map<BenefitType, TeamBenefit> byType = new EnumMap<>(BenefitType.class);
        Instant lastUpdated = null;
        for (TeamBenefit r : safe) {
            if (!period.equals(r.getPeriod())) {
                continue;
            }
            byType.put(r.getType(), r);
            if (r.getUpdatedAt() != null && (lastUpdated == null || r.getUpdatedAt().isAfter(lastUpdated))) {
                lastUpdated = r.getUpdatedAt();
            }
        }

        List<BenefitEntryDto> entries = Arrays.stream(BenefitType.values())
                .map(type -> {
                    TeamBenefit r = byType.get(type);
                    boolean financial = type.carriesValue() && r != null && r.getValue() != null;
                    return new BenefitEntryDto(type.key(), type.label(),
                            r == null ? null : r.getProcessCount(),
                            financial ? r.getValue() : null,
                            financial ? Objects.requireNonNullElse(r.getCurrency(), "TRY") : null);
                })
                .toList();

        return new TeamBenefitsSnapshotDto(API_VERSION, projectKey, team.getId(), team.getName(),
                period, lastUpdated, entries);
    }
}
