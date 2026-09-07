package com.aksa.capacityplanner.presentation.port.out;

import com.aksa.capacityplanner.presentation.domain.JointPresentation;

import java.util.List;
import java.util.Optional;

public interface JointPresentationRepositoryPort {

    JointPresentation save(JointPresentation jointPresentation);

    /** En yeni once (admin panelinde "tarih tarih" listelenir). */
    List<JointPresentation> findAllNewestFirst();

    Optional<JointPresentation> findById(Long id);

    void deleteById(Long id);
}
