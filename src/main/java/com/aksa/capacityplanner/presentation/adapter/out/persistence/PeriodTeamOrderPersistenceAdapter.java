package com.aksa.capacityplanner.presentation.adapter.out.persistence;

import com.aksa.capacityplanner.presentation.domain.PeriodTeamOrder;
import com.aksa.capacityplanner.presentation.port.out.PeriodTeamOrderRepositoryPort;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Component
public class PeriodTeamOrderPersistenceAdapter implements PeriodTeamOrderRepositoryPort {

    private final PeriodTeamOrderJpaRepository jpaRepository;

    public PeriodTeamOrderPersistenceAdapter(PeriodTeamOrderJpaRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    /**
     * Anahtar donemin tarihi oldugundan save() dogal olarak UPSERT davranir -
     * ayni doneme ikinci kez siralama yazan oncekinin ustune yazar. Gözde'nin
     * "kim sıralama yaptıysa o şekilde sonlansın" kurali tam olarak budur.
     */
    @Override
    public PeriodTeamOrder save(PeriodTeamOrder order) {
        PeriodTeamOrderJpaEntity entity = new PeriodTeamOrderJpaEntity();
        entity.setPeriodEnd(order.getPeriodEnd());
        entity.setTeamIds(new ArrayList<>(order.getTeamIds()));
        entity.setUpdatedBy(order.getUpdatedBy());
        return toDomain(jpaRepository.save(entity));
    }

    @Override
    public Optional<PeriodTeamOrder> findByPeriodEnd(LocalDate periodEnd) {
        return jpaRepository.findById(periodEnd).map(this::toDomain);
    }

    @Override
    public List<PeriodTeamOrder> findAll() {
        return jpaRepository.findAll().stream().map(this::toDomain).toList();
    }

    private PeriodTeamOrder toDomain(PeriodTeamOrderJpaEntity entity) {
        return new PeriodTeamOrder(entity.getPeriodEnd(), List.copyOf(entity.getTeamIds()),
                entity.getUpdatedBy(), entity.getUpdatedAt());
    }
}
