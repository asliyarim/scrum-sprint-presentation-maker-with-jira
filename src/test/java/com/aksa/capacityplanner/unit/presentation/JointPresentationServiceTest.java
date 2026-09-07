package com.aksa.capacityplanner.unit.presentation;

import com.aksa.capacityplanner.common.domain.DomainValidationException;
import com.aksa.capacityplanner.common.domain.NotFoundException;
import com.aksa.capacityplanner.presentation.domain.JointPresentation;
import com.aksa.capacityplanner.presentation.port.out.JointPresentationRepositoryPort;
import com.aksa.capacityplanner.presentation.usecase.JointPresentationService;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JointPresentationServiceTest {

    /** Bellek ici depo - projede Mockito kullanilmiyor, port dogrudan taklit edilir. */
    private static final class InMemoryRepo implements JointPresentationRepositoryPort {
        private final List<JointPresentation> rows = new ArrayList<>();
        private long seq = 1;

        @Override
        public JointPresentation save(JointPresentation j) {
            if (j.getId() == null) {
                j.setId(seq++);
                j.setCreatedAt(Instant.parse("2026-09-07T10:00:00Z"));
                rows.add(j);
            }
            return j;
        }

        @Override
        public List<JointPresentation> findAllNewestFirst() {
            List<JointPresentation> copy = new ArrayList<>(rows);
            copy.sort((a, b) -> Long.compare(b.getId(), a.getId()));
            return copy;
        }

        @Override
        public Optional<JointPresentation> findById(Long id) {
            return rows.stream().filter(r -> id.equals(r.getId())).findFirst();
        }

        @Override
        public void deleteById(Long id) {
            rows.removeIf(r -> id.equals(r.getId()));
        }
    }

    private final InMemoryRepo repo = new InMemoryRepo();
    private final JointPresentationService service = new JointPresentationService(repo);

    private static Map<String, Object> pick(long presentationId, int version, String team) {
        return Map.of("presentationId", presentationId, "version", version, "teamName", team);
    }

    @Test
    void savesPicksInOrderWithAuthorAndTitle() {
        JointPresentation saved = service.create("  Eylül Ortak Sunumu  ",
                List.of(pick(31, 3, "RPA"), pick(42, 7, "İş Zekası")), "40538");

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getTitle()).isEqualTo("Eylül Ortak Sunumu"); // kirpildi
        assertThat(saved.getCreatedBy()).isEqualTo("40538");
        assertThat(saved.getPicks()).hasSize(2);
        // SIRA korunmali - sunumdaki takim sirasi budur
        assertThat(saved.getPicks().get(0).get("teamName")).isEqualTo("RPA");
        assertThat(saved.getPicks().get(1).get("teamName")).isEqualTo("İş Zekası");
    }

    @Test
    void emptyTitleFallsBackToDefault() {
        assertThat(service.create(null, List.of(pick(1, 1, "A")), "x").getTitle()).isEqualTo("Ortak Sunum");
        assertThat(service.create("   ", List.of(pick(1, 1, "A")), "x").getTitle()).isEqualTo("Ortak Sunum");
    }

    @Test
    void rejectsInvalidInput() {
        assertThatThrownBy(() -> service.create("t", List.of(), "x"))
                .isInstanceOf(DomainValidationException.class);
        assertThatThrownBy(() -> service.create("t", null, "x"))
                .isInstanceOf(DomainValidationException.class);
        // presentationId/version olmadan kayit ILERIDE indirilemezdi
        assertThatThrownBy(() -> service.create("t", List.of(Map.of("teamName", "RPA")), "x"))
                .isInstanceOf(DomainValidationException.class);
        assertThatThrownBy(() -> service.create("t", List.of(Map.of("presentationId", 1)), "x"))
                .isInstanceOf(DomainValidationException.class);
    }

    @Test
    void listsNewestFirstAndDeletes() {
        service.create("ilk", List.of(pick(1, 1, "A")), "x");
        JointPresentation ikinci = service.create("ikinci", List.of(pick(2, 1, "B")), "x");

        assertThat(service.listNewestFirst()).extracting(JointPresentation::getTitle)
                .containsExactly("ikinci", "ilk");

        service.delete(ikinci.getId());
        assertThat(service.listNewestFirst()).extracting(JointPresentation::getTitle).containsExactly("ilk");
        assertThatThrownBy(() -> service.delete(999L)).isInstanceOf(NotFoundException.class);
    }
}
