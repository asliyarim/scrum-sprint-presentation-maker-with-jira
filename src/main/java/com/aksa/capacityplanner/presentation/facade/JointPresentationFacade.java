package com.aksa.capacityplanner.presentation.facade;

import com.aksa.capacityplanner.presentation.domain.JointPresentation;
import com.aksa.capacityplanner.presentation.port.in.JointPresentationUseCase;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * Ortak sunum kayitlari. Okuma ve kaydetme, sunumlarda oldugu gibi giris yapmis
 * herkese aciktir (ortak sunumu PO'lar hazirliyor). SILME ise yalnizca ADMIN ya
 * da kaydi OLUSTURAN kisiye aittir - baskasinin hazirladigi bir birlestirmeyi
 * kimse silemesin.
 */
@Component
public class JointPresentationFacade {

    private final JointPresentationUseCase jointPresentationUseCase;

    public JointPresentationFacade(JointPresentationUseCase jointPresentationUseCase) {
        this.jointPresentationUseCase = jointPresentationUseCase;
    }

    public JointPresentation create(String title, List<Map<String, Object>> picks, String callerSicil) {
        return jointPresentationUseCase.create(title, picks, callerSicil);
    }

    public List<JointPresentation> listNewestFirst() {
        return jointPresentationUseCase.listNewestFirst();
    }

    public JointPresentation getById(Long id) {
        return jointPresentationUseCase.getById(id);
    }

    public void delete(Long id, String callerSicil, boolean callerIsAdmin) {
        JointPresentation existing = jointPresentationUseCase.getById(id);
        if (!callerIsAdmin && (existing.getCreatedBy() == null || !existing.getCreatedBy().equals(callerSicil))) {
            throw new AccessDeniedException("Bu ortak sunumu silme yetkiniz yok.");
        }
        jointPresentationUseCase.delete(id);
    }
}
