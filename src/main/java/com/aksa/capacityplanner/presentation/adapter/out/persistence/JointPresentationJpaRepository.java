package com.aksa.capacityplanner.presentation.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface JointPresentationJpaRepository extends JpaRepository<JointPresentationJpaEntity, Long> {
    List<JointPresentationJpaEntity> findAllByOrderByCreatedAtDesc();
}
