import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "./TopBar";
import Button from "./Button";
import { IconUsers } from "./icons";
import { fetchTeams, fetchTeamBenefits, saveTeamBenefits } from "../../lib/apiClient";
import { DAV_COLORS } from "../../lib/format";
import { teamTypeLabel } from "../../lib/teamTypes";

/**
 * Backend'deki BenefitType ile BIREBIR ayni key/label/sira (dis dashboard
 * sozlesmesi, Nezih 04.09.2026 bolum 3.3). Yalnizca finansal kazanimda
 * toplam deger + para birimi girilir.
 */
export const BENEFIT_TYPES = [
  { key: "financial", label: "Finansal Kazanç", hasValue: true },
  { key: "errorReduction", label: "Hata Azaltma" },
  { key: "riskControl", label: "Risk ve Kontrol" },
  { key: "employeeExperience", label: "Çalışan Deneyimi" },
  { key: "customerExperience", label: "Müşteri Deneyimi" },
  { key: "dataQuality", label: "Veri Kalitesi" },
];

const EMPTY_FORM = () =>
  Object.fromEntries(BENEFIT_TYPES.map((t) => [t.key, { processCount: "", value: "", currency: "TRY" }]));

/** Kayitli satirlardan (bir donem) form durumu uretir - bos deger "" (bilinmiyor). */
function formFromRows(rows) {
  const form = EMPTY_FORM();
  for (const r of rows) {
    if (!form[r.key]) continue;
    form[r.key] = {
      processCount: r.processCount == null ? "" : String(r.processCount),
      value: r.value == null ? "" : String(r.value),
      currency: r.currency || "TRY",
    };
  }
  return form;
}

/** En son guncellenen donem - entegrasyon ucunun sectigi donemle AYNI kural. */
function latestPeriodOf(rows) {
  let best = null;
  for (const r of rows) {
    if (!best || String(r.updatedAt || "") > String(best.updatedAt || "")) best = r;
  }
  return best ? best.period : String(new Date().getFullYear());
}

/**
 * "Zaman Disi Kazanimlar" girisi (/admin/kazanimlar). Solda takim, sagda
 * secilen takim + donem icin 6 kazanim turu. Bos birakilan surec sayisi
 * "bilinmiyor" (null) olarak gider; 0 girilirse "hic surec yok" (0) - dis
 * dashboard bu ikisini ayri gosterir (bkz. backend TeamBenefit).
 */
export default function BenefitsAdminPage({ personnel, theme, onToggleTheme }) {
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTeamId, setSelectedTeamId] = useState(null);

  const [rows, setRows] = useState([]);
  const [period, setPeriod] = useState("");
  const [form, setForm] = useState(EMPTY_FORM());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);

  useEffect(() => {
    fetchTeams()
      .then((data) => {
        setTeams(data);
        if (data.length > 0) setSelectedTeamId(data[0].id);
      })
      .catch((err) => setError(err?.message || "Takımlar yüklenemedi."))
      .finally(() => setLoading(false));
  }, []);

  // Takim degisince kayitli satirlari cek, en son donemi sec ve formu doldur.
  useEffect(() => {
    if (selectedTeamId == null) return;
    let cancelled = false;
    setError(null);
    setSaved(null);
    fetchTeamBenefits(selectedTeamId)
      .then((data) => {
        if (cancelled) return;
        const list = data || [];
        setRows(list);
        const p = latestPeriodOf(list);
        setPeriod(p);
        setForm(formFromRows(list.filter((r) => r.period === p)));
      })
      .catch((err) => !cancelled && setError(err?.message || "Kazanım verisi yüklenemedi."));
    return () => {
      cancelled = true;
    };
  }, [selectedTeamId]);

  // Donem elle degistirilince o donemin kayitli degerleri (varsa) gelsin.
  const changePeriod = (p) => {
    setPeriod(p);
    setSaved(null);
    setForm(formFromRows(rows.filter((r) => r.period === p.trim())));
  };

  const setField = (key, field, val) => {
    setSaved(null);
    setForm((prev) => ({ ...prev, [key]: { ...prev[key], [field]: val } }));
  };

  const knownPeriods = useMemo(() => [...new Set(rows.map((r) => r.period))].sort().reverse(), [rows]);
  const selectedTeam = teams.find((t) => t.id === selectedTeamId) || null;

  const toNumber = (s) => {
    const t = String(s ?? "").trim().replace(",", ".");
    if (t === "") return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : NaN;
  };

  const handleSave = async () => {
    if (!selectedTeam) return;
    const p = period.trim();
    if (!p) {
      setError("Dönem boş olamaz (örn. 2026 ya da 2026-Q3).");
      return;
    }
    const entries = [];
    for (const t of BENEFIT_TYPES) {
      const f = form[t.key];
      const count = toNumber(f.processCount);
      const value = t.hasValue ? toNumber(f.value) : null;
      if (Number.isNaN(count) || Number.isNaN(value)) {
        setError(`"${t.label}" için sayısal bir değer girin.`);
        return;
      }
      if (count != null && (count < 0 || !Number.isInteger(count))) {
        setError(`"${t.label}" süreç sayısı 0 veya pozitif tam sayı olmalı.`);
        return;
      }
      entries.push({
        key: t.key,
        processCount: count,
        value: t.hasValue ? value : null,
        currency: t.hasValue && value != null ? (f.currency || "TRY").trim().toUpperCase() : null,
      });
    }
    setSaving(true);
    setError(null);
    try {
      const savedRows = await saveTeamBenefits(selectedTeam.id, p, entries);
      // Diger donemler aynen kalir, bu donemin satirlari yenilenir.
      setRows((prev) => [...prev.filter((r) => r.period !== p), ...(savedRows || [])]);
      setSaved(`${selectedTeam.name} · ${p} dönemi kaydedildi.`);
    } catch (err) {
      setError(err?.message || err?.error || "Kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <TopBar
        theme={theme}
        onToggleTheme={onToggleTheme}
        personnel={personnel}
        actions={
          <Button variant="ghost" onClick={() => navigate("/admin")}>
            ← Yönetim
          </Button>
        }
      />
      <main className="admin-split">
        <aside className="admin-team-panel">
          <h2 className="admin-team-panel-title">
            <IconUsers style={{ width: 18, height: 18 }} />
            Takımlar
          </h2>
          {loading && <div className="presentation-list-empty">Yükleniyor…</div>}
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
          </div>
        </aside>
        <section className="admin-presentation-panel">
          {!selectedTeam ? (
            <div className="presentation-list-empty">Bir takım seçin.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <h2 style={{ margin: "0 0 4px" }}>{selectedTeam.name} — Zaman Dışı Kazanımlar</h2>
                <div style={{ color: "var(--mut)", fontSize: 13, lineHeight: 1.6 }}>
                  Kazanım türü bazında, kazanım sağlanan <b>süreç sayısı</b>. Boş bırakılan alan
                  &quot;bilinmiyor&quot; olarak gider; <b>0</b> &quot;hiç süreç yok&quot; demektir. Bu veri
                  dış dashboard&#39;a <code>/api/integration/benefits</code> ucundan verilir.
                </div>
              </div>

              {error && <div className="login-error">{error}</div>}
              {saved && (
                <div className="login-error" style={{ background: "rgba(22,163,74,.10)", color: "#15803d", borderColor: "#86efac" }}>
                  ✓ {saved}
                </div>
              )}

              <label style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 600 }}>Dönem</span>
                <input
                  value={period}
                  onChange={(e) => changePeriod(e.target.value)}
                  placeholder="2026 ya da 2026-Q3"
                  list="benefit-periods"
                  style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--card)", color: "var(--ink)", minWidth: 160 }}
                />
                <datalist id="benefit-periods">
                  {knownPeriods.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
                {knownPeriods.length > 0 && (
                  <span style={{ color: "var(--mut)", fontSize: 12 }}>Kayıtlı dönemler: {knownPeriods.join(", ")}</span>
                )}
              </label>

              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560 }}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "var(--mut)", fontSize: 12 }}>
                      <th style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>Kazanım türü</th>
                      <th style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>Süreç sayısı</th>
                      <th style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>Toplam değer</th>
                      <th style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>Para birimi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {BENEFIT_TYPES.map((t) => (
                      <tr key={t.key}>
                        <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)", fontWeight: 600 }}>
                          {t.label}
                          <div style={{ color: "var(--mut)", fontSize: 11, fontWeight: 400 }}>{t.key}</div>
                        </td>
                        <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>
                          <input
                            inputMode="numeric"
                            value={form[t.key].processCount}
                            onChange={(e) => setField(t.key, "processCount", e.target.value)}
                            placeholder="bilinmiyor"
                            style={{ width: 110, padding: "6px 8px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--card)", color: "var(--ink)" }}
                          />
                        </td>
                        <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>
                          {t.hasValue ? (
                            <input
                              inputMode="decimal"
                              value={form[t.key].value}
                              onChange={(e) => setField(t.key, "value", e.target.value)}
                              placeholder="örn. 1250000"
                              style={{ width: 150, padding: "6px 8px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--card)", color: "var(--ink)" }}
                            />
                          ) : (
                            <span style={{ color: "var(--mut)" }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>
                          {t.hasValue ? (
                            <input
                              value={form[t.key].currency}
                              maxLength={3}
                              onChange={(e) => setField(t.key, "currency", e.target.value.toUpperCase())}
                              style={{ width: 64, padding: "6px 8px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--card)", color: "var(--ink)", textTransform: "uppercase" }}
                            />
                          ) : (
                            <span style={{ color: "var(--mut)" }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <Button variant="primary" onClick={handleSave} loading={saving} loadingLabel="Kaydediliyor…">
                  Kaydet
                </Button>
              </div>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
