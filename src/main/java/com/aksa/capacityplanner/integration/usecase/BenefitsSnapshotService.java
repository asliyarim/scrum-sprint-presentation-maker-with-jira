package com.aksa.capacityplanner.integration.usecase;

import com.aksa.capacityplanner.benefit.domain.TeamBenefit;
import com.aksa.capacityplanner.benefit.facade.BenefitFacade;
import com.aksa.capacityplanner.integration.api.dto.TeamBenefitsSnapshotDto;
import com.aksa.capacityplanner.team.facade.TeamFacade;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** Tum takimlari tek sorguyla toplar, donusumu BenefitsSnapshotMapper'a birakir. */
@Service
public class BenefitsSnapshotService {

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
                .filter(t -> t.getId() != null)
                .map(t -> BenefitsSnapshotMapper.toSnapshot(t, byTeam.getOrDefault(t.getId(), List.of())))
                .toList();
    }
}
