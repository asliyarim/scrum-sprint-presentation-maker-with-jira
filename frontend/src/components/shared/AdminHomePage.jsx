import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "./TopBar";
import PresentationListPanel from "./PresentationListPanel";
import JointPresentationListPanel from "./JointPresentationListPanel";
import Button from "./Button";
import { IconUsers, IconActivity, IconLayers } from "./icons";
import { fetchTeams } from "../../lib/apiClient";
import { DAV_COLORS } from "../../lib/format";
import { teamTypeLabel } from "../../lib/teamTypes";

/**
 * Admin login sonrasi dustugu yonetim ekrani (/admin) - solda takim secimi,
 * sagda secilen takimin kayitli sprint sunumlari. Admin her takimi hem
 * goruntuleyebilir hem duzenleyebilir (ayri bir "salt-okunur" mod yok -
 * "Duzenle" tiklaninca ayni sihirbaz ekrani /editor/:id ile acilir).
 */
export default function AdminHomePage({ personnel, theme, onToggleTheme }) {
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  // Sag panelde ne gosterilecek: bir takimin sunumlari mi, kaydedilmis ortak
  // sunumlar mi (Cagdas Bey istegi 2026-09-07 - "ortaklasmis halini tarih
  // tarih gormek istiyorum").
  const [jointSelected, setJointSelected] = useState(false);

  useEffect(() => {
    fetchTeams()
      .then((data) => {
        setTeams(data);
        if (data.length > 0) setSelectedTeamId(data[0].id);
      })
      .catch((err) => setError(err?.message || "Takımlar yüklenemedi."))
      .finally(() => setLoading(false));
  }, []);

  const selectedTeam = teams.find((t) => t.id === selectedTeamId) || null;

  return (
    <>
      <TopBar
        theme={theme}
        onToggleTheme={onToggleTheme}
        personnel={personnel}
        actions={
          <>
            <Button variant="ghost" onClick={() => navigate("/admin/kazanimlar")}>
              Kazanımlar
            </Button>
            <Button variant="ghost" onClick={() => navigate("/admin/monitoring")}>
              <IconActivity className="navbar-icon" />
              İzleme
            </Button>
          </>
        }
      />
      <main className="admin-split">
        <aside className="admin-team-panel">
          <h2 className="admin-team-panel-title">
            <IconUsers style={{ width: 18, height: 18 }} />
            Takımlar
          </h2>
          {loading && <div className="presentation-list-empty">Yükleniyor…</div>}
          {error && <div className="login-error" style={{ margin: "0 0 12px" }}>{error}</div>}
          <div className="admin-team-list">
            {teams.map((t, i) => (
              <button
                type="button"
                key={t.id}
                className={`admin-team-item${!jointSelected && t.id === selectedTeamId ? " active" : ""}`}
                style={{ "--team-accent": "#" + DAV_COLORS[i % DAV_COLORS.length] }}
                onClick={() => {
                  setSelectedTeamId(t.id);
                  setJointSelected(false);
                }}
              >
                <span className="admin-team-item-av" style={{ background: "#" + DAV_COLORS[i % DAV_COLORS.length] }}>
                  {(t.name || "?").slice(0, 2).toUpperCase()}
                </span>
                <span className="admin-team-item-text">
                  <span className="admin-team-item-name">{t.name}</span>
                  <span className="admin-team-item-type">{teamTypeLabel(t.teamType)}</span>
                </span>
              </button>
            ))}
            {!loading && teams.length === 0 && !error && (
              <div className="presentation-list-empty">Henüz tanımlı takım yok.</div>
            )}
          </div>

          {/* Takim listesinden AYRI bir baslik: kaydedilmis ortak sunumlar. */}
          <h2 className="admin-team-panel-title" style={{ marginTop: 18 }}>
            <IconLayers style={{ width: 18, height: 18 }} />
            Ortak Sunumlar
          </h2>
          <div className="admin-team-list">
            <button
              type="button"
              className={`admin-team-item${jointSelected ? " active" : ""}`}
              style={{ "--team-accent": "#0EA5A4" }}
              onClick={() => setJointSelected(true)}
            >
              <span className="admin-team-item-av" style={{ background: "#0EA5A4" }}>OR</span>
              <span className="admin-team-item-text">
                {/* Takim satirlarindaki gibi ikinci bir aciklama satiri YOK -
                    kullanici istegi 2026-09-07: "solda sidebarda ... tarih
                    tarih listele ve indir yazmasin". */}
                <span className="admin-team-item-name">Kaydedilmiş ortak sunumlar</span>
              </span>
            </button>
          </div>
        </aside>
        <section className="admin-presentation-panel">
          {jointSelected ? (
            <JointPresentationListPanel teams={teams} theme={theme} />
          ) : selectedTeam ? (
            <PresentationListPanel teamId={selectedTeam.id} teamName={selectedTeam.name} canManage showNewButton />
          ) : (
            <div className="presentation-list-empty">Bir takım seçin.</div>
          )}
        </section>
      </main>
    </>
  );
}
