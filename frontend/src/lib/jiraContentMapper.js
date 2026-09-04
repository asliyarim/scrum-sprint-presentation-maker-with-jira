import { formatWorkItemName } from "./excelParsers";
import { PRIORITY_COLORS, PRIORITY_ORDER } from "./geometry";
import { makeSuggestion } from "./suggestions";

/**
 * Jira'nin oncelik degerleri Ingilizce/karisik (instance genelinde farkli
 * projeler farkli semalar kullaniyor - GET /rest/api/3/priority ile
 * dogrulandi: Highest/High/Medium/Low/Low1/Acil/Çok Düşük/Yok/Engelleyici),
 * ama slayt/PPTX'teki madde isaretinin rengi (PRIORITY_COLORS, bkz.
 * geometry.js) SADECE 4 Turkce anahtari (Kritik/Yüksek/Orta/Düşük) taniyor.
 * "Yok" (oncelik belirtilmemis) BILEREK null - PRIORITY_UNSET_COLOR/
 * "Belirtilmedi" zaten SlideCanvas'ta bunu ele aliyor, yanlis bir seviye
 * uydurmaktansa bos birakmak daha dogru.
 */
const JIRA_PRIORITY_TO_TR = {
  Highest: "Kritik",
  Acil: "Kritik",
  Engelleyici: "Kritik",
  High: "Yüksek",
  Medium: "Orta",
  Low: "Düşük",
  Low1: "Düşük",
  "Çok Düşük": "Düşük",
  Yok: null,
};

/** Jira'nin oncelik metnini uygulamanin Turkce PRIORITY_COLORS anahtarina cevirir; bilinmeyen/bos deger icin null doner. */
export function translateJiraPriority(rawPriority) {
  if (!rawPriority) return null;
  if (Object.prototype.hasOwnProperty.call(JIRA_PRIORITY_TO_TR, rawPriority)) {
    return JIRA_PRIORITY_TO_TR[rawPriority];
  }
  return PRIORITY_COLORS[rawPriority] ? rawPriority : null;
}

/** "Tamamlanmis" kabul edilen status_code'lar (backend JiraStatusMapper her takim icin ayni 5 degere normalize eder). */
const DONE_STATUS_CODES = new Set(["Canlı", "UAT"]);

/**
 * "Tamamlanan İşler" kutusuna SADECE bu statudeki is kalemleri kaynaklik eder -
 * kullanici teyidi 2026-08-20: "tamamlanmış olanlar sadece canlı dakiler".
 * DONE_STATUS_CODES'tan (Canlı + UAT) BILEREK daha dardir: UAT'taki bir is
 * canliya alinmis sayilmaz, sunumda "tamamlandi" diye gosterilmemeli.
 */
const LIVE_STATUS_CODE = "Canlı";

/**
 * İçerik Slaytı'nin ust oge (Epic) listesine SADECE Gorev/Story seviyesindeki
 * kayitlar girer - PO notu 2026-08-19: "Görev/story alanlarındaki üst öğe
 * bilgisi alınacak". Alt gorevlerin "parent"i Epic DEGIL kendi hikayesidir;
 * alinsalardi liste yine story adlariyla sisecekti. Epic'in KENDISI de
 * dislanir (onun parent'i yok/baska bir Epic'tir).
 *
 * issue_type degeri Jira dilinden geldigi icin (TR/EN kurulumlar farkli)
 * her iki dildeki karsiliklar birlikte taninir; alani bos olan (eski
 * senkronizasyondan kalma) kayitlar DISLANMAZ - aksi halde henuz yeniden
 * senkronize edilmemis bir takimda liste bomboş kalirdi.
 */
const EXCLUDED_ISSUE_TYPES = new Set([
  "alt görev", "alt gorev", "alt-görev", "sub-task", "subtask", "sub task",
  "epic", "epik", "epi̇c",
]);

function isTaskOrStoryLevel(item) {
  const type = (item.issueType || "").trim().toLocaleLowerCase("tr");
  if (!type) return true; // bilinmiyorsa dislama - bkz. yukaridaki not
  return !EXCLUDED_ISSUE_TYPES.has(type);
}

/** Iki oncelikten slaytta daha "yukarida" olani (Kritik > Yüksek > Orta > Düşük > yok) doner. */
function strongerPriority(a, b) {
  const rank = (p) => {
    const i = PRIORITY_ORDER.indexOf(p);
    return i === -1 ? PRIORITY_ORDER.length : i;
  };
  return rank(a) <= rank(b) ? a : b;
}

/** Iki tarihten daha ESKI olani doner (bir Epic'in "eklenme tarihi" = altindaki en eski isin tarihi). */
function earlierDate(a, b) {
  if (!a) return b;
  if (!b) return a;
  return new Date(a) <= new Date(b) ? a : b;
}

/**
 * Bir takimin work_items listesini İçerik Slaytı'nin kutularina gore gruplar.
 *
 * PO notu (2026-08-19) ile TEMELDEN degisti:
 *  1. "Veriler Epicten çekilecek ... Alan kimliği = Parent" - artik tek tek
 *     Gorev/Story'ler degil, onlarin UST OGESI (parentKey/parentTitle)
 *     listelenir. Boylece "bu kadar çok veri" gelmez.
 *  2. "Aynı kayıt birden fazla olabilir sadece 1 tane gelmeli. Çoklanmamalı" -
 *     ayni Epic altindaki tum isler TEK bir maddeye indirgenir; bir Epic ayni
 *     anda iki kutuda da gorunmez (altinda hala acik is varsa Yapılacak,
 *     hepsi bittiyse Tamamlanan).
 *  3. "Tamamlanan İşler = bir önceki sprintin verilerini içerir" /
 *     "Yapılacak İşler = Mevcut sprintin verilerini içerir" - iki kutu FARKLI
 *     sprintlerden beslenir. "Bir onceki sprint" = takimin Jira verisindeki en
 *     son KAPANAN sprint (backend'de previousSprint olarak isaretlenir).
 *     Tamamlanan'a sadece o sprintin CANLI is kalemleri girer, Yapılacak'a
 *     aktif sprintte hala acik isi olan Epic'ler (kullanici teyidi 2026-08-20).
 *  4. "Bekleyen konular ve Riskleri Manuel PO'lar yazacak. Jiradan alma." -
 *     risk/pending kutulari Jira'dan HIC doldurulmaz (bos doner); Jira'nin
 *     "Flagged" alanina dayali eski Riskler eslemesi kaldirildi.
 *
 * Doner: { suggestions: {done, active, risk, pending}, stats }
 */
/**
 * Bir is kalemi listesini parentKey'e gore TEKILLESTIRILMIS Epic kayitlarina
 * cevirir. Ust ogesi olmayan kayitlar sayilir ama listeye girmez (Icerik
 * Slayti Epic seviyesinde calisir).
 */
function groupByParent(items) {
  const byParent = new Map();
  let withoutParent = 0;

  items.forEach((item) => {
    const key = (item.parentKey || "").trim();
    const title = (item.parentTitle || "").trim();
    if (!key || !title) {
      withoutParent++;
      return;
    }
    const priority = translateJiraPriority(item.priority);
    const done = DONE_STATUS_CODES.has(item.statusCode);
    const existing = byParent.get(key);
    if (!existing) {
      byParent.set(key, {
        key,
        title,
        sector: item.sector || null,
        priority,
        addedDate: item.addedDate || null,
        childCount: 1,
        openCount: done ? 0 : 1,
      });
      return;
    }
    existing.sector = existing.sector || item.sector || null;
    existing.priority = strongerPriority(existing.priority, priority);
    existing.addedDate = earlierDate(existing.addedDate, item.addedDate);
    existing.childCount += 1;
    if (!done) existing.openCount += 1;
  });

  return { byParent, withoutParent };
}

function toSuggestion(epic) {
  return makeSuggestion(formatWorkItemName(epic.title, epic.sector, null, epic.priority), {
    priority: epic.priority,
    sector: epic.sector,
    addedDate: epic.addedDate,
    childCount: epic.childCount,
    source: "jira",
  });
}

/**
 * previousSprintItems (bir onceki sprintin CANLI is kalemleri) icinden
 * GERCEK tekrarlari eler - ayni Jira kaydi iki kez gelmisse (orn. senkron
 * hatasi) jiraIssueKey ile, o da yoksa baslik+ust oge ile tekillestirilir.
 * Epic bazinda TEKILLESTIRME YAPILMAZ - kullanici teyidi 2026-08-20: "hala
 * tekrar edenler ... gelmeyecek" (sadece GERCEK tekrarlar elenecek, Epic
 * gruplamasi degil).
 *
 * NOT: "label ında takımın adı yazan epicteki işler gelmeyecek" kurali BURADA
 * HENUZ UYGULANMIYOR - Jira senkronizasyonu su an Epic'in Labels alanini
 * work_items'a hic tasimiyor (bkz. WorkItem.java), bu yuzden hangi Epic'in
 * hangi etiketi tasidigi frontend'e gelmiyor. Bu kural icin backend'e yeni
 * bir alan (Epic label senkronizasyonu) eklenmesi gerekiyor.
 */
function dedupeItems(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = item.jiraIssueKey
      ? "key:" + item.jiraIssueKey
      : "title:" + (item.parentKey || "") + "|" + (item.title || "").trim().toLocaleLowerCase("tr");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

/**
 * Bir is kaleminin bagli oldugu Epic'in Labels alaninda (item.parentLabels,
 * backend'de virgulle birlestirilmis - bkz. WorkItem.parentLabels) takimin
 * KENDI Jira proje anahtari (orn. "RPA") geciyor mu? Kullanici teyidi
 * 2026-08-20: "label ında takımın adı yazan epicteki işler gelmeyecek" -
 * orn. RPA-2206 "RPA Ekibi Agile Toplantılar" epic'i "RPA" label'i tasir,
 * bu idari/toplanti isidir, gercek teslim edilen is degildir.
 * jiraProjectKey verilmemisse (cagiran taraf bilmiyorsa) hicbir sey elenmez.
 */
function epicLabeledWithOwnTeam(item, jiraProjectKey) {
  if (!jiraProjectKey || !item.parentLabels) return false;
  const needle = jiraProjectKey.trim().toLocaleLowerCase("tr");
  if (!needle) return false;
  return item.parentLabels
    .split(",")
    .some((label) => label.trim().toLocaleLowerCase("tr") === needle);
}

export function bucketWorkItemsForContent(workItems, jiraProjectKey) {
  const taskLevel = (workItems || []).filter(isTaskOrStoryLevel);
  // Tamamlanan = BIR ONCEKI sprint (backend'de en son kapanan sprint olarak
  // isaretlenir - bkz. JiraSyncProcessor.resolvePreviousSprintId),
  // Yapılacak = MEVCUT (aktif) sprint.
  // Tamamlanan kutusuna kaynaklik eden kume, onceki sprintin SADECE CANLI
  // is kalemleridir (bkz. LIVE_STATUS_CODE).
  const previousSprintItems = taskLevel.filter(
    (item) => item.previousSprint && item.statusCode === LIVE_STATUS_CODE
  );
  const activeSprintItems = taskLevel.filter((item) => item.activeSprint);

  // Yapılacak İşler: aktif sprintteki gorev/story'lerin tekillestirilmis ust
  // ogesi (Epic).
  const current = groupByParent(activeSprintItems);

  const suggestions = { done: [], active: [], risk: [], pending: [] };

  // Yapılacak İşler: aktif sprintte HALA ACIK isi olan Epic'ler (kullanici
  // teyidi 2026-08-20: "Sadece tamamlanmamışlar").
  current.byParent.forEach((epic) => {
    if (epic.openCount === 0) return;
    suggestions.active.push(toSuggestion(epic));
  });

  // Tamamlanan İşler: bir onceki sprintin canli islerinin UST OGESI (Epic) -
  // Yapılacak ile AYNI seviye.
  //
  // Bu kural 2026-09-04'te GERI ALINDI: 2026-08-20'de "21 canlı işin hepsini
  // getirecek" denip ham is kalemine dusulmustu, ancak kullanici 2026-09-04'te
  // "tamamlanan işler kısmında parentler gelmiyor ... bir önceki sprintin
  // ticketlarinin parentlari, epicleri gelmeli" diyerek Epic seviyesine
  // donulmesini istedi. Ikisi ayni anda saglanamaz: Epic'e tekillestirmek
  // madde sayisini dusurur (ayni Epic altindaki 5 is tek satir olur) - bu
  // BILEREK kabul edilen davranistir.
  //
  // Epic'i takimin KENDI adiyla etiketlenmis (idari/toplanti isi) kayitlar,
  // gruplamadan ONCE elenir - bkz. epicLabeledWithOwnTeam.
  let excludedOwnTeamLabel = 0;
  const doneItems = dedupeItems(previousSprintItems).filter((item) => {
    if (epicLabeledWithOwnTeam(item, jiraProjectKey)) {
      excludedOwnTeamLabel++;
      return false;
    }
    return true;
  });
  const previous = groupByParent(doneItems);
  previous.byParent.forEach((epic) => {
    suggestions.done.push(toSuggestion(epic));
  });

  return {
    suggestions,
    stats: {
      previousSprintItemCount: previousSprintItems.length,
      activeSprintItemCount: activeSprintItems.length,
      epicCount: suggestions.active.length,
      // Ust ogesi olmadigi icin listelenemeyen kayitlar - iki kutunun toplami.
      withoutParent: current.withoutParent + previous.withoutParent,
      excludedOwnTeamLabel,
    },
  };
}

// NOT: buildBandTargetsFromWorkItems KALDIRILDI (2026-09-04).
//
// Hedefler bandini Jira'dan turetip otomatik yazan fonksiyondu; PO'nun AYNI
// slaytta elle girdigi cubuklari eziyordu (Is Zekasi ve RPA bandi manuel
// giriyor, "Jira'dan Getir"e basinca ustteki veri kayboluyordu - kullanici
// bildirimi 2026-09-04). Hedefler bandi artik yalnizca manuel/Excel
// kaynaklidir; bu dosya SADECE alttaki 4 icerik kartini besler.
