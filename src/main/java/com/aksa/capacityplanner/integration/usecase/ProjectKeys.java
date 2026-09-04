package com.aksa.capacityplanner.integration.usecase;

import com.aksa.capacityplanner.team.domain.Team;
import com.aksa.capacityplanner.team.domain.TeamType;

/**
 * Dis dashboard takimi Jira proje anahtariyla baglar (istek K1). Kaynak
 * Team.jiraProjectKey'dir (V18). Anahtari BOS olan takimlar icin dashboard
 * tarafinin bekledigi sabit deger kullanilir: CBS ekibinin Jira'da karsiligi
 * yok (bkz. V18 notu) ama dashboard onu "CBS" olarak tanir - bu deger
 * Jira senkronunda KULLANILMAZ, o yuzden teams.jira_project_key'e yazilmaz.
 * Karsiligi olmayan takim (orn. Mobil) null doner.
 */
final class ProjectKeys {

    private ProjectKeys() {
    }

    static String resolve(Team team) {
        if (team == null) {
            return null;
        }
        String key = team.getJiraProjectKey();
        if (key != null && !key.isBlank()) {
            return key.trim();
        }
        if (team.getTeamType() == TeamType.KONUM_TABANLI_URUN_GELISTIRME) {
            return "CBS";
        }
        return null;
    }
}
