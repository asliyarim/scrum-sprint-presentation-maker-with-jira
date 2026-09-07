import { fetchPresentationVersion } from "./apiClient";
import { sprintDataFromContent } from "./presentationContent";

/**
 * Kaydedilmis bir ortak sunumun "picks" listesini, PPTX uretimine hazir
 * sonuc dizisine cevirir - jointDeckBuilder.buildJointDeck'in bekledigi bicim.
 *
 * Ayni donusum Ortak Sunum ekraninin "Önizle" akisinda da yapilir
 * (JointPresentationPage.handleFetch); burada AYRI bir modul olmasinin sebebi,
 * admin panelindeki "Kaydedilmis Ortak Sunumlar" listesinden TEKRAR INDIRME
 * ozelliginin ayni mantigi kullanabilmesi (Cagdas Bey istegi, 2026-09-07).
 *
 * Sunum icerigi kayitta TEKRARLANMAZ; her (presentationId, version) cifti
 * versions tablosundan taze okunur - boylece surum gecmisi tek kaynakta kalir.
 * Bir surum cekilemezse (orn. sunum silinmis) o oge ATLANIR, digerleri
 * uretilmeye devam eder.
 */
export async function loadJointResults(picks, teams) {
  const built = [];
  for (const pk of picks || []) {
    let content;
    try {
      const detail = await fetchPresentationVersion(pk.presentationId, pk.version);
      content = detail?.content || {};
    } catch {
      continue;
    }
    const team = (teams || []).find((t) => t.id === pk.teamId);
    built.push({
      key: `${pk.presentationId}#${pk.version}`,
      teamId: pk.teamId,
      teamName: team?.name || pk.teamName || "Takım",
      sprintNo: pk.sprintNo,
      range: pk.dateRange || content?.dateRange || "",
      version: pk.version,
      presentationId: pk.presentationId,
      content,
      sprintData: sprintDataFromContent(content),
      dashData: content?.dashData || null,
      veloData: content?.veloData || null,
    });
  }
  return built;
}

/**
 * Ortak sunum ekranindaki secimleri (picks) kaydedilebilir bicime cevirir:
 * yeniden uretim icin GEREKLI olan presentationId + version'a ek olarak,
 * listede gosterim icin takim adi/sprint/tarih de tasinir.
 */
export function toSavablePicks(results) {
  return (results || []).map((r) => ({
    presentationId: r.presentationId,
    version: r.version,
    teamId: r.teamId,
    teamName: r.teamName,
    sprintNo: r.sprintNo,
    dateRange: r.range || "",
  }));
}
