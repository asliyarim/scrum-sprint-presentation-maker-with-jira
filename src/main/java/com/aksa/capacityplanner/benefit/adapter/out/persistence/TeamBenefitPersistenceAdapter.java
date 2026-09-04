package com.aksa.capacityplanner.benefit.adapter.out.persistence;

import com.aksa.capacityplanner.benefit.domain.BenefitType;
import com.aksa.capacityplanner.benefit.domain.TeamBenefit;
import com.aksa.capacityplanner.benefit.port.out.TeamBenefitRepositoryPort;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

@Component
public class TeamBenefitPersistenceAdapter implements TeamBenefitRepositoryPort {

    private final TeamBenefitJpaRepository jpaRepository;

    public TeamBenefitPersistenceAdapter(TeamBenefitJpaRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    public TeamBenefit save(TeamBenefit benefit) {
        TeamBenefitJpaEntity entity = benefit.getId() == null ? new TeamBenefitJpaEntity()
                : jpaRepository.findById(benefit.getId()).orElseGet(TeamBenefitJpaEntity::new);
        entity.setTeamId(benefit.getTeamId());
        entity.setPeriod(benefit.getPeriod());
        entity.setType(benefit.getType());
        entity.setProcessCount(benefit.getProcessCount());
        entity.setValue(benefit.getValue());
        entity.setCurrency(benefit.getCurrency());
        entity.setUpdatedBy(benefit.getUpdatedBy());
        return toDomain(jpaRepository.save(entity));
    }

    @Override
    public List<TeamBenefit> findByTeamId(Long teamId) {
        return jpaRepository.findByTeamId(teamId).stream().map(this::toDomain).toList();
    }

    @Override
    public Optional<TeamBenefit> findByTeamIdAndPeriodAndType(Long teamId, String period, BenefitType type) {
        return jpaRepository.findByTeamIdAndPeriodAndType(teamId, period, type).map(this::toDomain);
    }

    @Override
    public List<TeamBenefit> findAll() {
        return jpaRepository.findAll().stream().map(this::toDomain).toList();
    }

    private TeamBenefit toDomain(TeamBenefitJpaEntity e) {
        return new TeamBenefit(e.getId(), e.getTeamId(), e.getPeriod(), e.getType(), e.getProcessCount(),
                e.getValue(), e.getCurrency(), e.getUpdatedBy(), e.getUpdatedAt());
    }
}
