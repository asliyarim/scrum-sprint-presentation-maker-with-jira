package com.aksa.capacityplanner.integration.usecase;

import com.aksa.capacityplanner.integration.api.dto.CapacityTotalsDto;
import com.aksa.capacityplanner.integration.api.dto.MemberCapacitySnapshotDto;
import com.aksa.capacityplanner.integration.api.dto.TeamCapacitySnapshotDto;
import com.aksa.capacityplanner.presentation.domain.SprintPresentation;
import com.aksa.capacityplanner.team.domain.Team;
import com.aksa.capacityplanner.team.domain.TeamMember;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Sunum icerigindeki (content.dashData) serbest bicimli JSON'u dis sozlesmeye
 * cevirir. SAF sinif: Spring/DB yok, birim testte dogrudan cagrilir.
 *
 * Tum okumalar savunmacidir: eksik/bozuk alan istisna firlatmaz, null doner -
 * tek bir takimin bozuk kaydi tum listeyi dusurmesin.
 */
public final class CapacitySnapshotMapper {

    public static final int API_VERSION = 1;
    public static final String UNIT = "day";

    private static final String DASH_DATA = "dashData";
    private static final String KPIS = "kpis";
    private static final String PERSONS = "persons";
    private static final String DELTA = "delta";
    private static final String CUSTOM_KPIS = "customKpis";

    private static final Locale TR = Locale.forLanguageTag("tr");

    /**
     * Rol standartlastirma (K5). Anahtarlar kucuk harf (TR) + kirpilmis.
     * Gercek kayitlardan gorulen varyantlar: "Geliştici" (yazim hatasi),
     * "Developer", "BI Developer", "analist".
     */
    private static final Map<String, String> ROLE_CANON = foldKeys(Map.ofEntries(
            Map.entry("geliştirici", "Geliştirici"), Map.entry("gelistirici", "Geliştirici"),
            Map.entry("geliştici", "Geliştirici"), Map.entry("gelistici", "Geliştirici"),
            Map.entry("developer", "Geliştirici"), Map.entry("software developer", "Geliştirici"),
            Map.entry("bi developer", "Geliştirici"), Map.entry("yazılımcı", "Geliştirici"),
            Map.entry("analist", "Analist"), Map.entry("analyst", "Analist"),
            Map.entry("iş analisti", "Analist"), Map.entry("is analisti", "Analist"),
            Map.entry("business analyst", "Analist"), Map.entry("bi analist", "Analist"),
            Map.entry("test uzmanı", "Test Uzmanı"), Map.entry("tester", "Test Uzmanı"),
            Map.entry("qa", "Test Uzmanı")));

    /**
     * Turkce I/i sorununa dayanikli eslestirme anahtari: "BI Developer"
     * .toLowerCase(tr) "bı developer" verir ve "bi developer" ile ESLESMEZDI.
     * Once İ/ı -> I/i katlanir, sonra locale'den bagimsiz kucultulur; boylece
     * "İş", "BI", "YAZILIMCI" hepsi ayni anahtara duser. Yalnizca ESLESTIRME
     * icindir - gosterim degeri haritanin sag tarafindan gelir.
     */
    private static String foldKey(String s) {
        return s.replace('İ', 'I').replace('ı', 'i').toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
    }

    private static Map<String, String> foldKeys(Map<String, String> raw) {
        Map<String, String> out = new HashMap<>();
        raw.forEach((k, v) -> out.put(foldKey(k), v));
        return Map.copyOf(out);
    }

    private CapacitySnapshotMapper() {
    }

    public static TeamCapacitySnapshotDto toSnapshot(Team team, SprintPresentation latest, List<TeamMember> roster) {
        String projectKey = ProjectKeys.resolve(team);
        if (latest == null) {
            return new TeamCapacitySnapshotDto(API_VERSION, team.getId(), team.getName(), projectKey, UNIT,
                    null, null, null, null, null, null, null, List.of());
        }
        Map<String, Object> dashData = asMap(valueOf(latest.getContent(), DASH_DATA));
        Map<String, Object> kpis = asMap(valueOf(dashData, KPIS));
        Map<String, Object> delta = asMap(valueOf(dashData, DELTA));
        Map<String, TeamMember> rosterByKey = rosterIndex(roster);

        List<MemberCapacitySnapshotDto> members = asList(valueOf(dashData, PERSONS)).stream()
                .map(CapacitySnapshotMapper::asMap)
                .filter(m -> !m.isEmpty())
                .map(m -> toMember(m, rosterByKey))
                .toList();

        BigDecimal maintainedTotal = members.stream()
                .map(MemberCapacitySnapshotDto::maintainedCapacity)
                .filter(Objects::nonNull)
                .reduce(BigDecimal::add)
                .orElse(null);

        CapacityTotalsDto totals = kpis.isEmpty() ? null : new CapacityTotalsDto(
                scaled(kpis.get("toplam")),
                scaled(kpis.get("tamamlanan")),
                scaled(kpis.get("acik")),
                scaled(kpis.get("kapasite")),
                maintainedTotal,
                percent(kpis.get("doluluk")),
                scaled(kpis.get("acikFazla")),
                status(kpis.get("durum"), kpis.get("doluluk")),
                fteOf(asList(valueOf(dashData, CUSTOM_KPIS))),
                scaled(delta.get("kapanan")),
                scaled(delta.get("eklenen")),
                scaled(delta.get("net")));

        return new TeamCapacitySnapshotDto(API_VERSION, team.getId(), team.getName(), projectKey, UNIT,
                latest.getSprintNo(), latest.getDateRange(), text(dashData.get("dateRange")),
                text(dashData.get("reportDate")), latest.getUpdatedAt(), latest.getCurrentVersion(),
                totals, members);
    }

    private static MemberCapacitySnapshotDto toMember(Map<String, Object> person, Map<String, TeamMember> rosterByKey) {
        String name = text(person.get("name"));
        TeamMember matched = matchRoster(name, rosterByKey);
        String role = normalizeRole(text(person.get("role")));
        if (role == null && matched != null) {
            role = normalizeRole(matched.getRole());
        }
        String fullName = matched != null && matched.getFullName() != null && !matched.getFullName().isBlank()
                ? matched.getFullName().trim() : name;
        return new MemberCapacitySnapshotDto(
                name,
                fullName,
                matched != null ? blankToNull(matched.getJiraAccountId()) : null,
                role,
                scaled(person.get("toplam")),
                scaled(person.get("tamamlanan")),
                scaled(person.get("acik")),
                scaled(person.get("kapasite")),
                person.get("bakimliKapasite") != null ? scaled(person.get("bakimliKapasite"))
                        : scaled(person.get("kapasite")),
                maintenancePercent(person),
                percent(person.get("doluluk")),
                status(person.get("durum"), person.get("doluluk")));
    }

    // ---------- roster eslestirme (K2) ----------

    private static Map<String, TeamMember> rosterIndex(List<TeamMember> roster) {
        Map<String, TeamMember> index = new HashMap<>();
        for (TeamMember m : roster == null ? List.<TeamMember>of() : roster) {
            String key = nameKey(m == null ? null : m.getFullName());
            if (key != null) {
                index.putIfAbsent(key, m);
            }
        }
        return index;
    }

    /**
     * PO'nun yazdigi adi rosterde bulur: once TAM eslesme, tutmazsa TOKEN ALT
     * KUMESI ("Anıl" ⊆ "Anıl Muslu"). Birden fazla aday uyarsa BELIRSIZ kabul
     * edilip null doner - yanlis kisiye baglamaktansa baglamamak. Ayni ilke
     * JiraIntegration/TeamMemberMatcher'da da uygulanir.
     */
    static TeamMember matchRoster(String name, Map<String, TeamMember> rosterByKey) {
        String key = nameKey(name);
        if (key == null || rosterByKey.isEmpty()) {
            return null;
        }
        TeamMember exact = rosterByKey.get(key);
        if (exact != null) {
            return exact;
        }
        Set<String> tokens = tokensOf(key);
        TeamMember found = null;
        int hits = 0;
        for (Map.Entry<String, TeamMember> e : rosterByKey.entrySet()) {
            Set<String> other = tokensOf(e.getKey());
            if (!other.isEmpty() && (other.containsAll(tokens) || tokens.containsAll(other))) {
                found = e.getValue();
                hits++;
            }
        }
        return hits == 1 ? found : null;
    }

    static String nameKey(String name) {
        if (name == null) {
            return null;
        }
        String s = name.trim().toLowerCase(TR).replaceAll("\\s+", " ");
        return s.isEmpty() ? null : s;
    }

    private static Set<String> tokensOf(String normalized) {
        return Arrays.stream(normalized.split(" ")).filter(t -> !t.isBlank()).collect(Collectors.toSet());
    }

    // ---------- rol (K5) ----------

    public static String normalizeRole(String raw) {
        if (raw == null) {
            return null;
        }
        String s = raw.trim().replaceAll("\\s+", " ");
        if (s.length() < 3) {
            return null; // "A", "dd", "aa" gibi anlamsiz girisler
        }
        String canon = ROLE_CANON.get(foldKey(s));
        if (canon != null) {
            return canon;
        }
        // Tanimadigimiz ama anlamli gorunen bir rol: ilk harf buyuk, oldugu gibi.
        return s.substring(0, 1).toUpperCase(TR) + s.substring(1);
    }

    // ---------- FTE (K4) ----------

    /** customKpis icinde etiketi "FTE" iceren kartin degeri ("24,1" gibi formatli metin olabilir). */
    static BigDecimal fteOf(List<?> customKpis) {
        for (Object o : customKpis) {
            Map<String, Object> kpi = asMap(o);
            String label = text(kpi.get("label"));
            if (label != null && label.toLowerCase(TR).contains("fte")) {
                return scaled(kpi.get("value"));
            }
        }
        return null;
    }

    // ---------- durum (ekranla ayni esikler) ----------

    /**
     * Frontend'deki dStatus (lib/format.js) ile BIREBIR ayni: doluluk sayiysa
     * kayitli "durum" YOK SAYILIR ve etiket esiklerden turetilir. Kayitli ham
     * alan bayatlayabiliyor (CBS Sprint 11: kayitta "Yüksek Risk", ekranda
     * "Uygun"). Esikler oran uzerinden: >=1.2 Yüksek Risk, >=1.0 Risk, >=0.85 Dikkat.
     */
    public static String status(Object durum, Object doluluk) {
        BigDecimal ratio = raw(doluluk);
        if (ratio == null) {
            return text(durum);
        }
        if (ratio.compareTo(new BigDecimal("1.2")) >= 0) {
            return "Yüksek Risk";
        }
        if (ratio.compareTo(BigDecimal.ONE) >= 0) {
            return "Risk";
        }
        if (ratio.compareTo(new BigDecimal("0.85")) >= 0) {
            return "Dikkat";
        }
        return "Uygun";
    }

    // ---------- guvenli JSON okuma ----------

    private static Object valueOf(Map<String, Object> source, String key) {
        return source == null ? null : source.get(key);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> asMap(Object value) {
        return value instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of();
    }

    private static List<?> asList(Object value) {
        return value instanceof List<?> list ? list : List.of();
    }

    private static String text(Object value) {
        if (value == null) {
            return null;
        }
        String s = String.valueOf(value).trim();
        return s.isEmpty() ? null : s;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    /**
     * Sayiyi olcekten bagimsiz okur. TR formatli metni de kabul eder:
     * "24,1" -> 24.1, "1.250,50" -> 1250.50 (virgul varsa nokta binlik
     * ayiricidir); "12.5" gibi noktali metin oldugu gibi okunur.
     */
    public static BigDecimal raw(Object value) {
        if (value instanceof Number number) {
            return new BigDecimal(number.toString());
        }
        if (value instanceof String s && !s.isBlank()) {
            String t = s.trim();
            if (t.contains(",")) {
                t = t.replace(".", "").replace(',', '.');
            }
            try {
                return new BigDecimal(t);
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    static BigDecimal scaled(Object value) {
        BigDecimal n = raw(value);
        return n == null ? null : n.setScale(2, RoundingMode.HALF_UP);
    }

    /**
     * Takim kaydinda oran yoksa kullanilan varsayilan bakim/SR orani -
     * frontend'deki VARSAYILAN_BAKIM_ORANI (lib/format.js) ile AYNI.
     */
    private static final BigDecimal VARSAYILAN_BAKIM_ORANI = new BigDecimal("0.20");
    private static final BigDecimal TURETME_ALT_SINIR = new BigDecimal("0.001");
    private static final BigDecimal TURETME_UST_SINIR = new BigDecimal("0.9");

    /**
     * Kisi satirinin bakim/SR orani, YUZDE olarak (0.20 -> 20.00).
     *
     * Frontend'deki bakimOraniOf (lib/format.js) ile BIREBIR AYNI sirayla
     * turetilir, cunku ekrandaki "(bakım %20)" notu o fonksiyonun sonucudur -
     * kayitta alan olmasa bile ekran bir deger gosterir, servis de ayni degeri
     * vermelidir (kullanici karari 2026-09-04: "ekranda gordugumuz veriler
     * oldugu gibi"):
     *   1) kayitta bakimOrani varsa dogrudan o,
     *   2) bakimliKapasite < kapasite ise 1 - bakimli/kapasite,
     *   3) doluluk ve kapasiteden turetilebiliyorsa 1 - acik/(doluluk*kapasite)
     *      (yalnizca 0.001-0.9 araligindaysa; disi guvenilmez sayilir),
     *   4) hicbiri yoksa varsayilan 0.20.
     */
    static BigDecimal maintenancePercent(Map<String, Object> person) {
        return toPercent(maintenanceRatio(person));
    }

    private static BigDecimal maintenanceRatio(Map<String, Object> person) {
        BigDecimal acik = raw(person.get("bakimOrani"));
        if (acik != null) {
            return acik;
        }
        BigDecimal kapasite = raw(person.get("kapasite"));
        BigDecimal bakimli = raw(person.get("bakimliKapasite"));
        if (bakimli != null && kapasite != null && kapasite.signum() > 0 && bakimli.compareTo(kapasite) < 0) {
            return BigDecimal.ONE.subtract(bakimli.divide(kapasite, 6, RoundingMode.HALF_UP));
        }
        BigDecimal doluluk = raw(person.get("doluluk"));
        BigDecimal acikEfor = raw(person.get("acik"));
        if (doluluk != null && acikEfor != null && kapasite != null
                && doluluk.signum() > 0 && kapasite.signum() > 0) {
            BigDecimal payda = doluluk.multiply(kapasite);
            if (payda.signum() > 0) {
                BigDecimal turetilen = BigDecimal.ONE.subtract(acikEfor.divide(payda, 6, RoundingMode.HALF_UP));
                if (turetilen.compareTo(TURETME_ALT_SINIR) > 0 && turetilen.compareTo(TURETME_UST_SINIR) < 0) {
                    return turetilen;
                }
            }
        }
        return VARSAYILAN_BAKIM_ORANI;
    }

    private static BigDecimal toPercent(BigDecimal ratio) {
        return ratio == null ? null : ratio.multiply(BigDecimal.valueOf(100)).setScale(2, RoundingMode.HALF_UP);
    }

    /** Kayittaki doluluk ORAN'dir (1.59); disariya YUZDE (159.00). */
    static BigDecimal percent(Object value) {
        BigDecimal n = raw(value);
        return n == null ? null : n.multiply(BigDecimal.valueOf(100)).setScale(2, RoundingMode.HALF_UP);
    }

    /** "10.08.2026" / "7.9.2026" gibi TR tarihlerini yakalar. */
    private static final Pattern REPORT_DATE = Pattern.compile("(\\d{1,2})[.\\-/](\\d{1,2})[.\\-/](\\d{4})");

    /**
     * Sunumun dashData.reportDate degerini tarihe cevirir ("10.08.2026" ->
     * 2026-08-10). Alan yoksa, bos ise ("–" gibi) ya da bicim taninmiyorsa null
     * doner; cagiran taraf bunu "rapor tarihi bilinmiyor" olarak ele alir
     * (bkz. CapacitySnapshotService.raporTarihiGelmis).
     */
    public static LocalDate reportDateOf(SprintPresentation presentation) {
        if (presentation == null) {
            return null;
        }
        String raw = text(asMap(valueOf(presentation.getContent(), DASH_DATA)).get("reportDate"));
        if (raw == null) {
            return null;
        }
        Matcher m = REPORT_DATE.matcher(raw);
        if (!m.find()) {
            return null;
        }
        try {
            return LocalDate.of(Integer.parseInt(m.group(3)), Integer.parseInt(m.group(2)),
                    Integer.parseInt(m.group(1)));
        } catch (RuntimeException ignored) {
            return null; // 32.13.2026 gibi gecersiz tarih
        }
    }
}
