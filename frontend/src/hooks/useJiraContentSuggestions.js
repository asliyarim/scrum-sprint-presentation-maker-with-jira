import { useState } from "react";
import { fetchWorkItems } from "../lib/apiClient";
import { bucketWorkItemsForContent } from "../lib/jiraContentMapper";

/**
 * İçerik Slaytı'nin "Jira'dan Getir" akisi - useExcelSuggestions ile AYNI
 * chip/oneri seklinde calisir (SectionEditor bu ikisini birlestirip gosterir,
 * bkz. SprintPage.jsx), ama dosya yerine DB'de zaten senkronize edilmis
 * work_items'tan besler. "Jira'dan Çek" (üst çubuk, triggerJiraSync) ile AYNI
 * eylem DEGILDIR - o senkronizasyonu arka plana alir (asenkron), bu
 * ise senkronizasyonun SONUCUNU (DB'de zaten yazilmis olani) okur - Kapasite
 * Dashboard'un "Jira'dan" sekmesindeki "Çek sonra Yenile" deseniyle AYNI
 * (bkz. useJiraDashboard.js): once üst çubuktan "Jira'dan Çek", birkaç saniye
 * sonra burada "Jira'dan Getir".
 *
 * Getirilen icerik PO notu 2026-08-19 ile degisti: artik tek tek gorev/story
 * degil, gorev/story'lerin TEKILLESTIRILMIS UST OGESI (Epic) doner ve SADECE
 * done/active kutulari dolar - Riskler/Bekleyen Konular Jira'dan getirilmez,
 * PO'lar elle yazar (bkz. jiraContentMapper.js).
 *
 * Hedefler bandina DOKUNULMAZ: bu akis yalnizca alttaki 4 icerik kartini
 * besler (kullanici bildirimi 2026-09-04 - manuel girilen cubuklar eziliyordu).
 */
export function useJiraContentSuggestions() {
  const [suggestions, setSuggestions] = useState({ done: [], active: [], risk: [], pending: [] });
  const [info, setInfo] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchFromJira = async (teamId, jiraProjectKey) => {
    if (!teamId) {
      setError("Bu takım için henüz bir takım kaydı (teamId) bulunamadı.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const items = await fetchWorkItems(teamId);
      const { suggestions: bucketed, stats } = bucketWorkItemsForContent(items, jiraProjectKey);
      setSuggestions(bucketed);
      const total = bucketed.done.length + bucketed.active.length;
      setInfo(
        total > 0
          ? `Tamamlanan: önceki sprintin ${stats.previousSprintItemCount} canlı işinden ${bucketed.done.length} üst öğe (Epic). `
            + `Yapılacak: aktif sprintin ${stats.activeSprintItemCount} işinden ${bucketed.active.length} üst öğe (Epic).`
            + (stats.withoutParent > 0 ? ` ${stats.withoutParent} kayıt üst öğesi olmadığı için listelenmedi.` : "")
            + (stats.excludedOwnTeamLabel > 0 ? ` ${stats.excludedOwnTeamLabel} kayıt takımın kendi etiketini taşıyan (idari/toplantı) bir üst öğeye bağlı olduğu için listelenmedi.` : "")
            + " Riskler ve Bekleyen Konular Jira'dan getirilmez — bu iki bölümü elle yazın."
          : "Jira'dan hiç eşleşen madde bulunamadı - önce üst çubuktaki \"Jira'dan Çek\" ile senkronize edildiğinden, iş kalemlerinin bir sprinte ve bir üst öğeye (Epic) bağlı olduğundan emin ol."
      );
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const removeSuggestion = (section, text) => {
    setSuggestions((prev) => ({ ...prev, [section]: prev[section].filter((s) => s.text !== text) }));
  };

  const clear = () => {
    setSuggestions({ done: [], active: [], risk: [], pending: [] });
  };

  return { suggestions, info, error, loading, fetchFromJira, removeSuggestion, clear };
}
