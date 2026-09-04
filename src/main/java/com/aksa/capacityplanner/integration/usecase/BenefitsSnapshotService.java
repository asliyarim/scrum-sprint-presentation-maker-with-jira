package com.aksa.capacityplanner.integration.usecase;

import com.aksa.capacityplanner.benefit.domain.TeamBenefit;
import com.aksa.capacityplanner.benefit.facade.BenefitFacade;
import com.aksa.capacityplanner.integration.api.dto.TeamBenefitsSnapshotDto;
import com.aksa.capacityplanner.team.domain.Team;
import com.aksa.capacityplanner.team.domain.TeamType;
import com.aksa.capacityplanner.team.facade.TeamFacade;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Kazanim kaydi tutan takimlari tek sorguyla toplar, donusumu
 * BenefitsSnapshotMapper'a birakir.
 *
 * YALNIZCA RPA doner: "Zaman Disi Kazanimlar" karti RPA "Genel Isler" ekranina
 * ozgudur (gereksinim dokumani bolum 3; kullanici karari 2026-09-04: diger
 * takimlar listede hic yer almasin). Filtre takim ADINA degil TIPINE bagli -
 * ad degisse de calisir; ileride baska bir takim tipi eklenecekse
 * isBenefitTeam genisletilir.
 */
@Service
public class BenefitsSnapshotService {

    /** Kazanim ucunda yer alan takimlar - simdilik sadece RPA tipi. */
    static boolean isBenefitTeam(Team team) {
        return team != null && team.getId() != null && team.getTeamType() == TeamType.RPA;
    }

    private final TeamFacade teamFacade;
    private final BenefitFacade benefitFacade;

    public BenefitsSnapshotService(TeamFacade teamFacade, BenefitFacade benefitFacade) {
        this.teamFacade = teamFacade;
        this.benefitFacade = benefitFacade;
    }

    public List<TeamBenefitsSnapshotDto> listAll() {
        Map<Long, List<TeamBenefit>> byTeam = benefitFacade.listAll().stream()
                .filter(b -> b.getTeamId() != null)
                .collect(Collectors.groupingBy(TeamBenefit::getTeamId));
        return teamFacade.listTeams().stream()
                .filter(BenefitsSnapshotService::isBenefitTeam)
                .map(t -> BenefitsSnapshotMapper.toSnapshot(t, byTeam.getOrDefault(t.getId(), List.of())))
                .toList();
    }
}
