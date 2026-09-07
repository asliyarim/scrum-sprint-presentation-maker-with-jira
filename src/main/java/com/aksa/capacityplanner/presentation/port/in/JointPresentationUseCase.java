package com.aksa.capacityplanner.presentation.port.in;

import com.aksa.capacityplanner.presentation.domain.JointPresentation;

import java.util.List;
import java.util.Map;

public interface JointPresentationUseCase {

    JointPresentation create(String title, List<Map<String, Object>> picks, String createdBySicil);

    List<JointPresentation> listNewestFirst();

    JointPresentation getById(Long id);

    void delete(Long id);
}
