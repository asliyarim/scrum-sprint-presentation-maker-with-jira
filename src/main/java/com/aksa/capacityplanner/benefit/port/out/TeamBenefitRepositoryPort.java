package com.aksa.capacityplanner.benefit.port.out;

import com.aksa.capacityplanner.benefit.domain.BenefitType;
import com.aksa.capacityplanner.benefit.domain.TeamBenefit;

import java.util.List;
import java.util.Optional;

public interface TeamBenefitRepositoryPort {
    TeamBenefit save(TeamBenefit benefit);

    List<TeamBenefit> findByTeamId(Long teamId);

    Optional<TeamBenefit> findByTeamIdAndPeriodAndType(Long teamId, String period, BenefitType type);

    /** Tum takimlarin tum kayitlari - entegrasyon ucu tek sorguda toplar. */
    List<TeamBenefit> findAll();
}
