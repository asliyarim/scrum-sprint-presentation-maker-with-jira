package com.aksa.capacityplanner.presentation.usecase;

import com.aksa.capacityplanner.common.domain.DomainValidationException;
import com.aksa.capacityplanner.common.domain.NotFoundException;
import com.aksa.capacityplanner.presentation.domain.JointPresentation;
import com.aksa.capacityplanner.presentation.port.in.JointPresentationUseCase;
import com.aksa.capacityplanner.presentation.port.out.JointPresentationRepositoryPort;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class JointPresentationService implements JointPresentationUseCase {

    /** Bir ortak sunumda birlestirilebilecek en fazla takim sayisi - kazara devasa kayit olusmasin. */
    static final int MAX_PICKS = 50;
    static final int MAX_TITLE_LENGTH = 200;

    private final JointPresentationRepositoryPort repository;

    public JointPresentationService(JointPresentationRepositoryPort repository) {
        this.repository = repository;
    }

    @Override
    public JointPresentation create(String title, List<Map<String, Object>> picks, String createdBySicil) {
        if (picks == null || picks.isEmpty()) {
            throw new DomainValidationException("Ortak sunum bos olamaz - en az bir sunum secilmeli.");
        }
        if (picks.size() > MAX_PICKS) {
            throw new DomainValidationException("Bir ortak sunumda en fazla " + MAX_PICKS + " sunum birlestirilebilir.");
        }
        // Her oge yeniden uretim icin GEREKLI iki alani tasimali; eksikse kayit
        // ileride indirilemezdi, bu yuzden kaydetmeden once dogrulanir.
        for (Map<String, Object> pick : picks) {
            if (pick == null || pick.get("presentationId") == null || pick.get("version") == null) {
                throw new DomainValidationException("Secimlerde presentationId ve version zorunlu.");
            }
        }
        JointPresentation entity = new JointPresentation();
        entity.setTitle(normalizeTitle(title));
        entity.setPicks(picks);
        entity.setCreatedBy(createdBySicil);
        return repository.save(entity);
    }

    @Override
    public List<JointPresentation> listNewestFirst() {
        return repository.findAllNewestFirst();
    }

    @Override
    public JointPresentation getById(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new NotFoundException("Ortak sunum bulunamadi: id=" + id));
    }

    @Override
    public void delete(Long id) {
        getById(id); // yoksa 404
        repository.deleteById(id);
    }

    private static String normalizeTitle(String title) {
        String t = title == null ? "" : title.trim();
        if (t.isEmpty()) {
            t = "Ortak Sunum";
        }
        return t.length() > MAX_TITLE_LENGTH ? t.substring(0, MAX_TITLE_LENGTH) : t;
    }
}
