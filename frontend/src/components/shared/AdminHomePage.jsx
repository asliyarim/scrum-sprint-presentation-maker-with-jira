import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "./TopBar";
import PresentationListPanel from "./PresentationListPanel";
import Button from "./Button";
import { IconUsers, IconActivity } from "./icons";
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
                className={`admin-team-item${t.id === selectedTeamId ? " active" : ""}`}
                style={{ "--team-accent": "#" + DAV_COLORS[i % DAV_COLORS.length] }}
                onClick={() => setSelectedTeamId(t.id)}
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
        </aside>
        <section className="admin-presentation-panel">
          {selectedTeam ? (
            <PresentationListPanel teamId={selectedTeam.id} teamName={selectedTeam.name} canManage showNewButton />
          ) : (
            <div className="presentation-list-empty">Bir takım seçin.</div>
          )}
        </section>
      </main>
    </>
  );
}
