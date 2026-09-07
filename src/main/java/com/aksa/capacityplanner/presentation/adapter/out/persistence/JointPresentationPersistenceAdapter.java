package com.aksa.capacityplanner.presentation.adapter.out.persistence;

import com.aksa.capacityplanner.presentation.domain.JointPresentation;
import com.aksa.capacityplanner.presentation.port.out.JointPresentationRepositoryPort;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

@Component
public class JointPresentationPersistenceAdapter implements JointPresentationRepositoryPort {

    private final JointPresentationJpaRepository jpaRepository;

    public JointPresentationPersistenceAdapter(JointPresentationJpaRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    public JointPresentation save(JointPresentation jointPresentation) {
        JointPresentationJpaEntity entity = jointPresentation.getId() == null
                ? new JointPresentationJpaEntity()
                : jpaRepository.findById(jointPresentation.getId()).orElseGet(JointPresentationJpaEntity::new);
        entity.setTitle(jointPresentation.getTitle());
        entity.setPicks(jointPresentation.getPicks());
        entity.setCreatedBy(jointPresentation.getCreatedBy());
        return toDomain(jpaRepository.save(entity));
    }

    @Override
    public List<JointPresentation> findAllNewestFirst() {
        return jpaRepository.findAllByOrderByCreatedAtDesc().stream().map(this::toDomain).toList();
    }

    @Override
    public Optional<JointPresentation> findById(Long id) {
        return jpaRepository.findById(id).map(this::toDomain);
    }

    @Override
    public void deleteById(Long id) {
        jpaRepository.deleteById(id);
    }

    private JointPresentation toDomain(JointPresentationJpaEntity e) {
        return new JointPresentation(e.getId(), e.getTitle(), e.getPicks(), e.getCreatedBy(), e.getCreatedAt());
    }
}
