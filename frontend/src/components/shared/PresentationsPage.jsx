import { useEffect, useState } from "react";
import TopBar from "./TopBar";
import PresentationListPanel from "./PresentationListPanel";
import { fetchTeams } from "../../lib/apiClient";

/**
 * PO'nun kayitli sprint sunumlarini gordugu sayfa (/presentations).
 *
 * BIRDEN FAZLA takima bakan PO'lar (orn. Dijital Uygulamalar + CBS + Mobil)
 * her takimi AYRI baslik altinda gorur - eskiden burada sadece
 * personnel.teamId (BIRINCIL takim) listeleniyordu, dolayisiyla ikinci/ucuncu
 * takimin sunumlari kaydedilmis olsa bile arayuzde hic gorunmuyordu
 * (kullanici bildirimleri 2026-08-25: "Sunumlarım diyince mobil ve DU ayrı
 * başlık altında görünmesi gerekiyor", "2. ekiplerimizi ekleyemiyoruz").
 * Yetki listesi backend'inkiyle AYNI kaynaktan gelir: JWT'deki teamIds
 * (bkz. PresentationFacade.requireEditAccess).
 */
export default function PresentationsPage({ personnel, theme, onToggleTheme }) {
  const [teams, setTeams] = useState(null);

  // Birincil takim HER ZAMAN ilk sirada; kalanlar takim adina gore siralanir.
  const teamIds = (() => {
    const list = personnel?.teamIds?.length
      ? [...personnel.teamIds]
      : personnel?.teamId != null ? [personnel.teamId] : [];
    const birincil = personnel?.teamId;
    return list
      .filter((id, i) => list.indexOf(id) === i)
      .sort((a, b) => (a === birincil ? -1 : b === birincil ? 1 : 0));
  })();

  useEffect(() => {
    if (!teamIds.length) return;
    fetchTeams()
      .then(setTeams)
      .catch(() => {
        // takim adlari cekilemezse departman etiketiyle devam edilir
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personnel]);

  const teamName = (id) =>
    teams?.find((t) => t.id === id)?.name || (id === personnel?.teamId ? personnel?.department || "" : "");

  return (
    <>
      <TopBar theme={theme} onToggleTheme={onToggleTheme} personnel={personnel} />
      <main className="presentations-page">
        {teamIds.length ? (
          teamIds.map((id) => (
            <PresentationListPanel key={id} teamId={id} teamName={teamName(id)} canManage showNewButton={false} />
          ))
        ) : (
          <div className="presentation-list-empty">Takımınız belirlenemedi, lütfen yöneticinizle iletişime geçin.</div>
        )}
      </main>
    </>
  );
}
