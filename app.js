// RM NIERUCHOMOŚCI, AML: karta klienta, ocena ryzyka, wydruki, terminy
// Dane tylko w tym urządzeniu, zaszyfrowane hasłem (krypto.js). Zero serwera.
// Podstawa merytoryczna: Wewnętrzna procedura AML dla nieruchomości (Grupa Format), § 4 do 34.
'use strict';

const WERSJA = 1;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
document.querySelectorAll('[data-wersja]').forEach((el) => { el.textContent = 'v' + WERSJA; });

// ---------- SŁOWNIKI (z procedury AML dla nieruchomości) ----------
const CZ_NISKIE = [
  ['n_ue', 'Klient jest rezydentem UE lub EOG, a transakcja jest powiązana tylko z tymi państwami'],
  ['n_publ', 'Klient to jednostka sektora finansów publicznych, przedsiębiorstwo państwowe albo spółka z większościowym udziałem Skarbu Państwa lub samorządu'],
  ['n_gielda', 'Klient to spółka notowana na rynku regulowanym albo jej spółka zależna'],
  ['n_kraj', 'Klient jest rezydentem państwa trzeciego o niskim poziomie korupcji i z przepisami AML na poziomie UE']
];
const CZ_PODW = [
  ['p_okolicz', 'Nawiązanie współpracy w nietypowych okolicznościach'],
  ['p_obecnosc', 'Brak fizycznej obecności klienta (bez podpisu kwalifikowanego lub profilu zaufanego)'],
  ['p_odleglosc', 'Brak bezpośredniego kontaktu albo nieuzasadniona odległość między miejscem zamieszkania lub siedzibą klienta a biurem'],
  ['p_trzeci', 'Transakcję zleca lub finansuje nieznana albo niepowiązana z klientem osoba trzecia'],
  ['p_gotowka', 'Zapłata w gotówce albo przez operatora przekazów pieniężnych'],
  ['p_cena', 'Cena transakcji daleko odbiega od wartości rynkowej'],
  ['p_przeplyw', 'Brak faktycznego przepływu pieniędzy mimo zawarcia umowy sprzedaży'],
  ['p_zagranica', 'Środki pochodzą z zagranicy albo ich źródło jest niejasne'],
  ['p_struktura', 'Nietypowa lub nadmiernie złożona struktura własności klienta (firma)'],
  ['p_anonim', 'Podmiot do przechowywania majątku osobistego, akcje na okaziciela albo produkty sprzyjające anonimowości'],
  ['p_gotowkowa', 'Działalność klienta opiera się na wielu lub dużych transakcjach gotówkowych'],
  ['p_zachowanie', 'Nietypowe zachowanie klienta: unika pytań, nalega na pośpiech, zmienia dane, daje niespójne dokumenty']
];
const CZ_WYS = [
  ['w_kraj', 'Powiązanie z państwem trzecim wysokiego ryzyka (lista KE, FATF), państwem objętym sankcjami UE albo rajem podatkowym'],
  ['w_sankcje', 'Klient, beneficjent rzeczywisty albo pełnomocnik jest na liście sankcyjnej'],
  ['w_podejrzenie', 'Okoliczności wskazują na podejrzenie prania pieniędzy lub finansowania terroryzmu']
];
const SRODKI = [
  ['s_id', 'Identyfikacja klienta i weryfikacja tożsamości na podstawie dokumentu'],
  ['s_pelnomocnik', 'Identyfikacja osoby działającej w imieniu klienta i weryfikacja umocowania'],
  ['s_br', 'Identyfikacja beneficjenta rzeczywistego (CRBR) i ustalenie struktury własności'],
  ['s_rejestry', 'Weryfikacja w rejestrach: KRS lub CEIDG, REGON, biała lista VAT, VIES'],
  ['s_sankcje', 'Sprawdzenie list sankcyjnych (Polska i UE)'],
  ['s_pep', 'Oświadczenie PEP od klienta'],
  ['s_cel', 'Ustalenie celu i charakteru transakcji'],
  ['s_zrodlo', 'Ustalenie źródła pochodzenia środków'],
  ['s_monitor', 'Bieżące monitorowanie stosunków z klientem'],
  ['s_wzmozone', 'Wzmożone środki: zgoda kierownictwa, ustalenie źródła majątku, częstsze monitorowanie']
];
const GRUPY = { '1': 'Niskie', '2': 'Normalne', '3': 'Podwyższone', '4': 'Wysokie', PEP: 'PEP, środki wzmożone' };
const ROLE = ['Sprzedający', 'Kupujący', 'Wynajmujący', 'Najemca', 'Inna'];
const PLATNOSCI = ['Przelew ze środków własnych', 'Kredyt bankowy', 'Przelew i kredyt bankowy', 'Gotówka', 'Nie dotyczy (sprzedający / wynajmujący)', 'Inna'];
const DOKUMENTY = ['Dowód osobisty', 'Paszport', 'Karta pobytu', 'mObywatel', 'Inny'];
const FORMY = ['Spółka z o.o.', 'Spółka akcyjna', 'Spółka jawna', 'Spółka komandytowa', 'Spółka cywilna', 'Jednoosobowa działalność', 'Fundacja lub stowarzyszenie', 'Inna'];
const etykieta = (lista, id) => (lista.find((x) => x[0] === id) || [id, id])[1];

// ---------- DATY ----------
const dzis = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const fmt = (iso) => iso ? iso.split('-').reverse().join('.') : '';
const dodajLata = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); const t = new Date(Date.UTC(y + n, m - 1, d)); return t.toISOString().slice(0, 10); };
const dniDo = (iso) => Math.round((Date.parse(iso) - Date.parse(dzis())) / 86400000);
const zl = (v) => v ? Number(v).toLocaleString('pl-PL') + ' zł' : '';
const id = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ---------- WALIDACJA ----------
function peselOk(p) {
  if (!/^\d{11}$/.test(p)) return false;
  const w = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3]; let s = 0;
  for (let i = 0; i < 10; i++) s += w[i] * +p[i];
  return (10 - (s % 10)) % 10 === +p[10];
}
function dataZPesel(p) {
  if (!peselOk(p)) return '';
  let r = +p.slice(0, 2), m = +p.slice(2, 4); const d = p.slice(4, 6);
  if (m > 80) { r += 1800; m -= 80; } else if (m > 60) { r += 2200; m -= 60; } else if (m > 40) { r += 2100; m -= 40; } else if (m > 20) { r += 2000; m -= 20; } else r += 1900;
  return `${r}-${String(m).padStart(2, '0')}-${d}`;
}
function nipOk(n) {
  n = String(n || '').replace(/\D/g, '');
  if (n.length !== 10) return false;
  const w = [6, 5, 7, 2, 3, 4, 5, 6, 7]; let s = 0;
  for (let i = 0; i < 9; i++) s += w[i] * +n[i];
  return s % 11 === +n[9];
}

// ---------- STAN ----------
let baza = null;
const nowaBaza = () => ({
  klienci: [], oceny: [], dziennik: [],
  ustawienia: { podmiot: { nazwa: '', adres: '', nip: '' }, pracownik: 'Rafał Lenart', ostatniaKopia: null }
});
const stan = { widok: 'pulpit', param: null, szkic: null, szukaj: '' };

function zapiszDziennik(co) {
  baza.dziennik.unshift({ t: new Date().toISOString(), co });
  if (baza.dziennik.length > 500) baza.dziennik.length = 500;
}
async function zapisz(co) {
  if (co) zapiszDziennik(co);
  try { await Sejf.zapisz(baza); } catch (e) { toast('Nie udało się zapisać: ' + e.message); throw e; }
}

const klientNazwa = (k) => k ? (k.typ === 'firma' ? k.nazwa : `${k.imie || ''} ${k.nazwisko || ''}`.trim()) || '(bez nazwy)' : '(usunięty klient)';
const klient = (kid) => baza.klienci.find((k) => k.id === kid);
const ocenyKlienta = (kid) => baza.oceny.filter((o) => o.klientId === kid).sort((a, b) => (b.data || '').localeCompare(a.data || ''));
const ostatniaZatw = (kid) => ocenyKlienta(kid).find((o) => o.zatwierdzona);

// ---------- POMOCNICZE UI ----------
let toastT = null;
function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 3200); }

const pole = (lab, name, val, opt = {}) => `
  <label>${esc(lab)}${opt.wym ? ' <b class="wym">*</b>' : ''}
    <input type="${opt.typ || 'text'}" name="${name}" value="${esc(val)}" ${opt.inputmode ? `inputmode="${opt.inputmode}"` : ''} ${opt.ph ? `placeholder="${esc(opt.ph)}"` : ''} autocomplete="off">
  </label>`;
const obszar = (lab, name, val, ph) => `<label>${esc(lab)}<textarea name="${name}" rows="2" ${ph ? `placeholder="${esc(ph)}"` : ''}>${esc(val)}</textarea></label>`;
const wybor = (lab, name, val, lista) => `<label>${esc(lab)}<select name="${name}">${lista.map((x) => `<option ${x === val ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>`;
const ptaszek = (lab, name, on) => `<label class="przelacznik"><input type="checkbox" name="${name}" ${on ? 'checked' : ''}><span>${esc(lab)}</span></label>`;
const znaczek = (g) => g ? `<span class="znaczek g${esc(g)}">${esc(GRUPY[g] || g)}</span>` : '<span class="znaczek brak">brak oceny</span>';

function zbierz(kontener) {
  const o = {};
  $$('[name]', kontener).forEach((el) => { o[el.name] = el.type === 'checkbox' ? el.checked : el.value.trim(); });
  return o;
}

// ---------- NAWIGACJA ----------
function pokaz(widok, param = null) {
  stan.widok = widok; stan.param = param;
  $$('#nawigacja button').forEach((b) => b.classList.toggle('on', b.dataset.nav === widok || (b.dataset.nav === 'klienci' && /klient|ocena/.test(widok))));
  const w = $('#widok');
  w.innerHTML = (WIDOKI[widok] || WIDOKI.pulpit)(param);
  window.scrollTo(0, 0);
  if (PO[widok]) PO[widok](param);
}

// =====================================================================
// WIDOKI
// =====================================================================
const WIDOKI = {};
const PO = {};

// ---------- PULPIT ----------
WIDOKI.pulpit = () => {
  const d = dzis();
  const alerty = [];
  const u = baza.ustawienia;

  if (!u.podmiot.nazwa) alerty.push(['zolty', 'Uzupełnij dane biura, pojawią się w nagłówku wydruków.', 'ustawienia']);
  const dniKopii = u.ostatniaKopia ? -dniDo(u.ostatniaKopia) : null;
  if (baza.klienci.length && (dniKopii === null || dniKopii > 14)) {
    alerty.push(['zolty', dniKopii === null ? 'Nie ma jeszcze kopii zapasowej. Dane są tylko w tym urządzeniu.' : `Ostatnia kopia zapasowa ${dniKopii} dni temu.`, 'ustawienia']);
  }

  const wygasle = [], wygasa = [], bezOceny = [], doUsuniecia = [];
  for (const k of baza.klienci) {
    const o = ostatniaZatw(k.id);
    if (!o) { if (!k.archiwum) bezOceny.push(k); }
    else if (!k.archiwum) {
      const n = dniDo(o.waznaDo);
      if (n < 0) wygasle.push([k, o]); else if (n <= 30) wygasa.push([k, o]);
    }
    const oc = ocenyKlienta(k.id).filter((x) => x.zatwierdzona);
    if (k.archiwum && oc.length && oc.every((x) => x.przechowujDo < d)) doUsuniecia.push(k);
  }
  const szkice = baza.oceny.filter((o) => !o.zatwierdzona);
  const pilne = baza.oceny.filter((o) => o.zatwierdzona && (o.wysokie || []).includes('w_podejrzenie') && dniDo(o.data) > -14);

  const wiersz = (k, o, opis) => `<button class="wiersz" data-akcja="klient" data-id="${k.id}"><span>${esc(klientNazwa(k))}</span><span class="wiersz-prawa">${opis}</span></button>`;
  const sekcja = (tytul, lista, kolor) => lista.length ? `<div class="card ${kolor || ''}"><div class="card-title">${tytul} <span class="licznik">${lista.length}</span></div>${lista.join('')}</div>` : '';

  const aktywni = baza.klienci.filter((k) => !k.archiwum).length;
  const zatw = baza.oceny.filter((o) => o.zatwierdzona).length;

  return `
    <div class="kafle">
      <button class="kafel" data-akcja="nav" data-cel="klienci"><b>${aktywni}</b><span>klientów</span></button>
      <button class="kafel" data-akcja="nav" data-cel="klienci"><b>${zatw}</b><span>ocen ryzyka</span></button>
      <button class="kafel ${wygasle.length + wygasa.length ? 'alarm' : ''}" data-akcja="nav" data-cel="pulpit"><b>${wygasle.length + wygasa.length}</b><span>do odnowienia</span></button>
    </div>
    ${alerty.map(([kol, t, cel]) => `<button class="alert ${kol}" data-akcja="nav" data-cel="${cel}">${esc(t)}</button>`).join('')}
    ${sekcja('🚨 Zawiadomienie GIIF', pilne.map((o) => wiersz(klient(o.klientId) || {}, o, 'najpóźniej 2 dni robocze')), 'czerwona')}
    ${sekcja('⛔ Ocena ryzyka wygasła', wygasle.map(([k, o]) => wiersz(k, o, 'od ' + fmt(o.waznaDo))), 'czerwona')}
    ${sekcja('⏳ Wygasa w ciągu 30 dni', wygasa.map(([k, o]) => wiersz(k, o, 'do ' + fmt(o.waznaDo))), 'zolta')}
    ${sekcja('📝 Klienci bez zatwierdzonej oceny', bezOceny.map((k) => wiersz(k, null, 'zrób ocenę')))}
    ${sekcja('✏️ Szkice ocen do zatwierdzenia', szkice.map((o) => `<button class="wiersz" data-akcja="ocena" data-id="${o.id}"><span>${esc(klientNazwa(klient(o.klientId)))}</span><span class="wiersz-prawa">${fmt(o.data)}</span></button>`))}
    ${sekcja('🗄 Minął okres przechowywania (5 lat), można usunąć', doUsuniecia.map((k) => wiersz(k, null, 'usuń')))}
    ${!baza.klienci.length ? `
      <div class="pusto">
        <div class="pusto-ikona">🛡️</div>
        <p><b>Dodaj pierwszego klienta.</b></p>
        <p class="hint">Kolejność jak w procedurze: karta klienta, oświadczenie klienta (PEP, źródło środków) do podpisu, sprawdzenie rejestrów i list sankcyjnych, potem ocena ryzyka. Wszystko zostaje w tym urządzeniu, zaszyfrowane Twoim hasłem.</p>
        <div class="przyciski"><button class="btn-primary" data-akcja="nowy" data-typ="osoba">+ Osoba</button><button class="btn" data-akcja="nowy" data-typ="firma">+ Firma</button></div>
      </div>` : (!alerty.length && !wygasle.length && !wygasa.length && !bezOceny.length && !szkice.length ? '<div class="card ok">✅ Wszystko w terminie. Nie ma nic do zrobienia.</div>' : '')}
  `;
};

// ---------- LISTA KLIENTÓW ----------
WIDOKI.klienci = () => `
  <div class="przyciski gora">
    <button class="btn-primary" data-akcja="nowy" data-typ="osoba">+ Osoba</button>
    <button class="btn-primary" data-akcja="nowy" data-typ="firma">+ Firma</button>
  </div>
  <input type="search" id="szukaj" class="szukaj" placeholder="Szukaj: nazwisko, firma, NIP, PESEL" value="${esc(stan.szukaj)}">
  <label class="przelacznik maly"><input type="checkbox" id="pokaz-arch" ${stan.archiwum ? 'checked' : ''}><span>Pokaż zakończonych (archiwum)</span></label>
  <div id="lista-klientow"></div>`;
PO.klienci = () => {
  const rysuj = () => {
    const q = stan.szukaj.toLowerCase();
    const lista = baza.klienci
      .filter((k) => stan.archiwum ? true : !k.archiwum)
      .filter((k) => !q || [klientNazwa(k), k.nip, k.pesel, k.regon, k.krs].join(' ').toLowerCase().includes(q))
      .sort((a, b) => klientNazwa(a).localeCompare(klientNazwa(b), 'pl'));
    $('#lista-klientow').innerHTML = lista.length ? lista.map((k) => {
      const o = ostatniaZatw(k.id);
      const n = o ? dniDo(o.waznaDo) : null;
      const termin = o ? (n < 0 ? `<span class="czerwony">wygasła ${fmt(o.waznaDo)}</span>` : `ważna do ${fmt(o.waznaDo)}`) : '';
      return `<button class="klient-karta" data-akcja="klient" data-id="${k.id}">
        <span class="kk-ikona">${k.typ === 'firma' ? '🏢' : '👤'}</span>
        <span class="kk-tresc"><b>${esc(klientNazwa(k))}</b><small>${k.typ === 'firma' ? 'NIP ' + esc(k.nip || 'brak') : (k.pep ? 'PEP · ' : '') + (k.zagraniczny ? 'zagraniczny · ' : '') + esc(k.obywatelstwo || '')} ${k.archiwum ? '· archiwum' : ''}</small><small>${termin}</small></span>
        ${znaczek(o && o.grupa)}
      </button>`;
    }).join('') : '<p class="hint centr">Brak klientów.</p>';
  };
  $('#szukaj').addEventListener('input', (e) => { stan.szukaj = e.target.value; rysuj(); });
  $('#pokaz-arch').addEventListener('change', (e) => { stan.archiwum = e.target.checked; rysuj(); });
  rysuj();
};

// ---------- FORMULARZ KLIENTA ----------
function pustyKlient(typ) {
  return { id: null, typ, obywatelstwo: typ === 'osoba' ? 'polskie' : '', krajUr: typ === 'osoba' ? 'Polska' : '', dokTyp: 'Dowód osobisty', forma: 'Spółka z o.o.', beneficjenci: typ === 'firma' ? [{}] : [], repr: {}, maRepr: typ === 'firma' };
}
WIDOKI.klientForm = () => {
  const k = stan.szkic;
  const osoba = k.typ === 'osoba';
  const r = k.repr || {};
  return `
  <div class="naglowek-widoku"><button class="link-btn" data-akcja="${k.id ? 'klient' : 'nav'}" data-id="${k.id || ''}" data-cel="klienci">← Wróć</button><h2>${k.id ? 'Edycja klienta' : osoba ? 'Nowa osoba' : 'Nowa firma'}</h2></div>
  <form id="f-klient" autocomplete="off">
  ${osoba ? `
    <div class="card"><div class="card-title">Dane osoby (§ 11 procedury)</div>
      <div class="dwie">${pole('Imię', 'imie', k.imie, { wym: 1 })}${pole('Nazwisko', 'nazwisko', k.nazwisko, { wym: 1 })}</div>
      ${pole('PESEL', 'pesel', k.pesel, { inputmode: 'numeric', ph: 'gdy brak, wpisz datę urodzenia' })}
      <p class="ostrz" id="pesel-info" hidden></p>
      <div class="dwie">${pole('Data urodzenia', 'dataUr', k.dataUr, { typ: 'date' })}${pole('Państwo urodzenia', 'krajUr', k.krajUr)}</div>
      ${pole('Obywatelstwo', 'obywatelstwo', k.obywatelstwo, { wym: 1 })}
      <div class="dwie">${wybor('Dokument tożsamości', 'dokTyp', k.dokTyp, DOKUMENTY)}${pole('Seria i numer', 'dokNr', k.dokNr, { wym: 1 })}</div>
      ${pole('Adres zamieszkania', 'adres', k.adres)}
      <div class="dwie">${pole('Telefon', 'telefon', k.telefon, { typ: 'tel' })}${pole('E-mail', 'email', k.email, { typ: 'email' })}</div>
      <details ${k.dzNip ? 'open' : ''}><summary>Prowadzi działalność gospodarczą</summary>
        ${pole('Nazwa firmy', 'dzNazwa', k.dzNazwa)}${pole('NIP', 'dzNip', k.dzNip, { inputmode: 'numeric' })}${pole('Adres głównego miejsca działalności', 'dzAdres', k.dzAdres)}
      </details>
    </div>` : `
    <div class="card"><div class="card-title">Dane firmy (§ 11 procedury)</div>
      ${pole('Nazwa (firma)', 'nazwa', k.nazwa, { wym: 1 })}
      ${wybor('Forma organizacyjna', 'forma', k.forma, FORMY)}
      <div class="dwie">${pole('NIP', 'nip', k.nip, { inputmode: 'numeric', wym: 1 })}${pole('REGON', 'regon', k.regon, { inputmode: 'numeric' })}</div>
      <p class="ostrz" id="nip-info" hidden></p>
      ${pole('KRS', 'krs', k.krs, { inputmode: 'numeric' })}
      ${pole('Adres siedziby', 'siedziba', k.siedziba, { wym: 1 })}
      ${pole('Państwo rejestracji (gdy brak NIP)', 'krajRej', k.krajRej)}
      <div class="dwie">${pole('Telefon', 'telefon', k.telefon, { typ: 'tel' })}${pole('E-mail', 'email', k.email, { typ: 'email' })}</div>
    </div>
    <div class="card"><div class="card-title">Beneficjenci rzeczywiści (§ 12)</div>
      <p class="hint">Osoby fizyczne, które kontrolują firmę (zwykle ponad 25% udziałów lub głosów). Sprawdź w CRBR i dopisz.</p>
      ${(k.beneficjenci || []).map((b, i) => `
        <div class="podkarta">
          <div class="dwie">${pole('Imię', `b_imie_${i}`, b.imie)}${pole('Nazwisko', `b_nazwisko_${i}`, b.nazwisko)}</div>
          <div class="dwie">${pole('Obywatelstwo', `b_obywatelstwo_${i}`, b.obywatelstwo)}${pole('PESEL lub data urodzenia', `b_pesel_${i}`, b.pesel)}</div>
          ${pole('Rodzaj kontroli (np. 60% udziałów, prezes)', `b_kontrola_${i}`, b.kontrola)}
          <button type="button" class="link-btn danger-link" data-akcja="usun-ben" data-i="${i}">Usuń beneficjenta</button>
        </div>`).join('')}
      <button type="button" class="btn" data-akcja="dodaj-ben">+ Dodaj beneficjenta</button>
      ${ptaszek('Firma nie ma wpisu w CRBR albo dane się nie zgadzają (zgłoś to w ocenie ryzyka)', 'crbrRozbieznosc', k.crbrRozbieznosc)}
    </div>`}
    <div class="card"><div class="card-title">${osoba ? 'Pełnomocnik (§ 13)' : 'Osoba reprezentująca (§ 11, § 13)'}</div>
      ${osoba ? ptaszek('Klient działa przez pełnomocnika', 'maRepr', k.maRepr) : '<input type="hidden" name="maRepr" value="1">'}
      <div id="repr-box" ${osoba && !k.maRepr ? 'hidden' : ''}>
        <div class="dwie">${pole('Imię', 'r_imie', r.imie)}${pole('Nazwisko', 'r_nazwisko', r.nazwisko)}</div>
        <div class="dwie">${pole('PESEL lub data urodzenia', 'r_pesel', r.pesel)}${pole('Obywatelstwo', 'r_obywatelstwo', r.obywatelstwo)}</div>
        <div class="dwie">${pole('Państwo urodzenia (gdy brak PESEL)', 'r_krajUr', r.krajUr)}${pole('Podstawa umocowania', 'r_umocowanie', r.umocowanie, { ph: osoba ? 'np. pełnomocnictwo notarialne Rep. A ...' : 'np. prezes zarządu, KRS' })}</div>
      </div>
    </div>
    <div class="card"><div class="card-title">Status</div>
      ${ptaszek('Klient zagraniczny', 'zagraniczny', k.zagraniczny)}
      ${ptaszek(osoba ? 'PEP: osoba na eksponowanym stanowisku politycznym, członek jej rodziny albo bliski współpracownik' : 'PEP: beneficjent lub osoba reprezentująca jest PEP, członkiem rodziny PEP albo bliskim współpracownikiem', 'pep', k.pep)}
      <details class="hint"><summary>Kto jest PEP? (§ 3 procedury)</summary>
        Szefowie państw i rządów, ministrowie, wiceministrowie, sekretarze stanu; posłowie i senatorowie; członkowie zarządów partii; sędziowie SN, TK, NSA, WSA i sądów apelacyjnych; członkowie zarządu NBP i trybunałów obrachunkowych; ambasadorzy i wyżsi oficerowie; zarządy i rady nadzorcze spółek Skarbu Państwa; dyrektorzy organizacji międzynarodowych; dyrektorzy generalni urzędów centralnych i wojewódzkich. Także ich małżonkowie, dzieci z małżonkami i rodzice oraz bliscy współpracownicy. Status trwa jeszcze co najmniej 12 miesięcy po odejściu ze stanowiska.
      </details>
      <div id="pep-box" ${k.pep ? '' : 'hidden'}>${pole('Kto i jakie stanowisko', 'pepOpis', k.pepOpis)}</div>
      ${obszar('Uwagi', 'uwagi', k.uwagi)}
    </div>
    <button type="submit" class="btn-primary wide duzy">💾 Zapisz klienta</button>
  </form>`;
};
function zbierzKlienta() {
  const f = $('#f-klient'); const d = zbierz(f); const k = stan.szkic;
  const wynik = { ...k };
  for (const [kl, v] of Object.entries(d)) if (!/^(b_|r_)/.test(kl)) wynik[kl] = v;
  wynik.maRepr = k.typ === 'firma' ? true : !!d.maRepr;
  wynik.repr = { imie: d.r_imie, nazwisko: d.r_nazwisko, pesel: d.r_pesel, obywatelstwo: d.r_obywatelstwo, krajUr: d.r_krajUr, umocowanie: d.r_umocowanie };
  if (k.typ === 'firma') {
    wynik.beneficjenci = (k.beneficjenci || []).map((_, i) => ({ imie: d[`b_imie_${i}`], nazwisko: d[`b_nazwisko_${i}`], obywatelstwo: d[`b_obywatelstwo_${i}`], pesel: d[`b_pesel_${i}`], kontrola: d[`b_kontrola_${i}`] }));
  }
  return wynik;
}
PO.klientForm = () => {
  const f = $('#f-klient');
  const pesel = f.elements.pesel, nip = f.elements.nip;
  if (pesel) {
    const spr = () => {
      const v = pesel.value.trim(), info = $('#pesel-info');
      info.hidden = !v || peselOk(v);
      info.textContent = 'PESEL ma błędną sumę kontrolną. Sprawdź z dokumentem.';
      if (peselOk(v) && !f.elements.dataUr.value) f.elements.dataUr.value = dataZPesel(v);
    };
    pesel.addEventListener('input', spr); spr();
  }
  if (nip) {
    const spr = () => { const v = nip.value.trim(), info = $('#nip-info'); info.hidden = !v || nipOk(v); info.textContent = 'NIP ma błędną sumę kontrolną.'; };
    nip.addEventListener('input', spr); spr();
  }
  if (f.elements.maRepr && f.elements.maRepr.type === 'checkbox') f.elements.maRepr.addEventListener('change', (e) => { $('#repr-box').hidden = !e.target.checked; });
  f.elements.pep.addEventListener('change', (e) => { $('#pep-box').hidden = !e.target.checked; });
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const k = zbierzKlienta();
    const brak = k.typ === 'osoba'
      ? [!k.imie && 'imię', !k.nazwisko && 'nazwisko', !k.obywatelstwo && 'obywatelstwo', !k.dokNr && 'numer dokumentu', !k.pesel && !k.dataUr && 'PESEL albo data urodzenia']
      : [!k.nazwa && 'nazwa', !k.nip && !k.krajRej && 'NIP albo państwo rejestracji', !k.siedziba && 'adres siedziby'];
    const b = brak.filter(Boolean);
    if (b.length && !confirm('Brakuje: ' + b.join(', ') + '.\nProcedura wymaga tych danych do identyfikacji. Zapisać mimo to?')) return;
    const nowy = !k.id;
    if (nowy) { k.id = id(); k.utworzono = new Date().toISOString(); baza.klienci.push(k); }
    else { k.zmieniono = new Date().toISOString(); baza.klienci[baza.klienci.findIndex((x) => x.id === k.id)] = k; }
    await zapisz((nowy ? 'Dodano klienta: ' : 'Zmieniono dane klienta: ') + klientNazwa(k));
    stan.szkic = null;
    toast('Zapisano');
    pokaz('klient', k.id);
  });
};

// ---------- KARTA KLIENTA ----------
WIDOKI.klient = (kid) => {
  const k = klient(kid);
  if (!k) return '<p>Nie ma takiego klienta.</p>';
  const oc = ocenyKlienta(kid);
  const ost = oc.find((o) => o.zatwierdzona);
  const osoba = k.typ === 'osoba';
  const w = (l, v) => v ? `<div class="dana"><span>${esc(l)}</span><b>${esc(v)}</b></div>` : '';
  const r = k.repr || {};
  const mozeUsunac = !oc.some((o) => o.zatwierdzona) || oc.filter((o) => o.zatwierdzona).every((o) => o.przechowujDo < dzis());
  return `
  <div class="naglowek-widoku"><button class="link-btn" data-akcja="nav" data-cel="klienci">← Klienci</button>
    <h2>${osoba ? '👤' : '🏢'} ${esc(klientNazwa(k))}</h2>${znaczek(ost && ost.grupa)}${k.archiwum ? ' <span class="znaczek brak">archiwum</span>' : ''}</div>
  ${ost ? `<p class="hint">Ocena ważna do <b>${fmt(ost.waznaDo)}</b>${dniDo(ost.waznaDo) < 0 ? ' <span class="czerwony">(wygasła)</span>' : ''}. Przechowywać dokumenty do ${fmt(ost.przechowujDo)}.</p>` : ''}

  <div class="card"><div class="card-title">Kolejne kroki</div>
    <div class="kroki">
      <button class="krok" data-akcja="druk-oswiadczenie" data-id="${k.id}"><b>1</b><span>Oświadczenie klienta do podpisu<small>PEP, źródło środków${osoba ? '' : ', beneficjenci'}</small></span></button>
      <button class="krok" data-akcja="nav" data-cel="rejestry" data-id="${k.id}"><b>2</b><span>Sprawdź rejestry i listy sankcyjne<small>${osoba ? 'listy sankcyjne' : 'CRBR, KRS, biała lista, sankcje'}</small></span></button>
      <button class="krok" data-akcja="nowa-ocena" data-id="${k.id}"><b>3</b><span>${ost ? 'Nowa ocena ryzyka (aktualizacja)' : 'Ocena ryzyka'}<small>grupa ryzyka i środki</small></span></button>
      <button class="krok" data-akcja="druk-karta" data-id="${k.id}"><b>4</b><span>Karta identyfikacji i weryfikacji<small>do teczki transakcji</small></span></button>
    </div>
  </div>

  <div class="card"><div class="card-title">Oceny ryzyka</div>
    ${oc.length ? oc.map((o) => `<button class="wiersz" data-akcja="ocena" data-id="${o.id}"><span>${fmt(o.data)} · ${esc(o.rola || '')} ${esc(o.nieruchomosc || '')}</span><span class="wiersz-prawa">${o.zatwierdzona ? znaczek(o.grupa) : '<span class="znaczek brak">szkic</span>'}</span></button>`).join('') : '<p class="hint">Brak ocen.</p>'}
  </div>

  <div class="card"><div class="card-title">Dane</div>
    ${osoba ? `${w('PESEL', k.pesel)}${w('Data urodzenia', fmt(k.dataUr))}${w('Państwo urodzenia', k.krajUr)}${w('Obywatelstwo', k.obywatelstwo)}${w(k.dokTyp || 'Dokument', k.dokNr)}${w('Adres', k.adres)}${w('Działalność', [k.dzNazwa, k.dzNip && 'NIP ' + k.dzNip, k.dzAdres].filter(Boolean).join(', '))}`
    : `${w('Forma', k.forma)}${w('NIP', k.nip)}${w('REGON', k.regon)}${w('KRS', k.krs)}${w('Siedziba', k.siedziba)}${w('Państwo rejestracji', k.krajRej)}
       ${(k.beneficjenci || []).filter((b) => b.nazwisko).map((b) => w('Beneficjent', [b.imie, b.nazwisko, b.obywatelstwo, b.kontrola].filter(Boolean).join(', '))).join('')}`}
    ${k.maRepr && r.nazwisko ? w(osoba ? 'Pełnomocnik' : 'Reprezentant', [r.imie, r.nazwisko, r.umocowanie].filter(Boolean).join(', ')) : ''}
    ${w('Telefon', k.telefon)}${w('E-mail', k.email)}
    ${w('Klient zagraniczny', k.zagraniczny ? 'tak' : '')}${w('PEP', k.pep ? 'TAK. ' + (k.pepOpis || '') : '')}${w('Uwagi', k.uwagi)}
    <div class="przyciski">
      <button class="btn" data-akcja="edytuj" data-id="${k.id}">✏️ Edytuj dane</button>
      ${!osoba && k.nip ? `<button class="btn" data-akcja="kopiuj" data-tekst="${esc(k.nip.replace(/\D/g, ''))}">📋 Kopiuj NIP</button>` : ''}
      <button class="btn" data-akcja="archiwum" data-id="${k.id}">${k.archiwum ? '↩ Przywróć z archiwum' : '🗄 Zakończ współpracę (archiwum)'}</button>
      ${mozeUsunac ? `<button class="btn danger" data-akcja="usun-klienta" data-id="${k.id}">🗑 Usuń</button>` : ''}
    </div>
    ${!mozeUsunac ? '<p class="hint">Klienta z zatwierdzoną oceną nie da się usunąć przed końcem 5 lat przechowywania (§ 20 procedury).</p>' : ''}
  </div>`;
};

// ---------- OCENA RYZYKA ----------
function domyslneSrodki(k, o) {
  const s = ['s_id', 's_sankcje', 's_pep', 's_cel'];
  if (k.maRepr) s.push('s_pelnomocnik');
  if (k.typ === 'firma') s.push('s_br', 's_rejestry');
  if (o.rola === 'Kupujący' || o.rola === 'Najemca') s.push('s_zrodlo');
  return s;
}
function sugeruj(o, k) {
  const w = o.wysokie || [], p = o.podwyzszone || [], n = o.niskie || [];
  if (w.length) return { g: '4', dlaczego: 'zaznaczony czynnik wysokiego ryzyka' };
  if (k && k.pep) return { g: 'PEP', dlaczego: 'klient lub osoba z nim związana jest PEP (§ 19)' };
  if (p.length >= 3) return { g: '4', dlaczego: `${p.length} czynniki podwyższonego ryzyka naraz` };
  if (p.length) return { g: '3', dlaczego: `czynniki podwyższonego ryzyka: ${p.length}` };
  if (n.length) return { g: '1', dlaczego: 'spełnione kryterium niskiego ryzyka (§ 5), brak czynników podwyższonych' };
  return { g: '2', dlaczego: 'brak czynników podwyższonego ryzyka (§ 6)' };
}
const waznosc = (data, g) => dodajLata(data, g === '1' || g === '2' ? 2 : 1);
const przechowuj = (o) => { const y = +((o.dataTransakcji && o.dataTransakcji > o.data ? o.dataTransakcji : o.data) || dzis()).slice(0, 4); return `${y + 5}-12-31`; };

WIDOKI.ocenaForm = () => {
  const o = stan.szkic, k = klient(o.klientId);
  const lista = (def, nazwa, zazn) => def.map(([kod, t]) => `<label class="przelacznik czynnik"><input type="checkbox" name="${nazwa}" value="${kod}" ${zazn.includes(kod) ? 'checked' : ''}><span>${esc(t)}</span></label>`).join('');
  return `
  <div class="naglowek-widoku"><button class="link-btn" data-akcja="klient" data-id="${k.id}">← ${esc(klientNazwa(k))}</button><h2>Ocena ryzyka</h2></div>
  <form id="f-ocena" autocomplete="off">
    <div class="card"><div class="card-title">Transakcja</div>
      <div class="dwie">${pole('Data oceny', 'data', o.data, { typ: 'date' })}${wybor('Rola klienta', 'rola', o.rola, ROLE)}</div>
      ${pole('Nieruchomość', 'nieruchomosc', o.nieruchomosc, { ph: 'adres, rodzaj' })}
      <div class="dwie">${pole('Wartość transakcji (zł)', 'wartosc', o.wartosc, { inputmode: 'numeric' })}${pole('Planowana data transakcji', 'dataTransakcji', o.dataTransakcji, { typ: 'date' })}</div>
      ${wybor('Forma płatności', 'platnosc', o.platnosc, PLATNOSCI)}
      ${pole('Źródło pochodzenia środków', 'zrodlo', o.zrodlo, { ph: 'np. sprzedaż mieszkania, oszczędności z wynagrodzenia, kredyt w banku X' })}
      ${pole('Cel i charakter transakcji', 'cel', o.cel, { ph: 'np. zakup na potrzeby własne, inwestycja pod wynajem' })}
    </div>
    ${k.pep ? `<div class="card czerwona"><b>Klient oznaczony jako PEP.</b> ${esc(k.pepOpis || '')}<br>Potrzebna zgoda kierownictwa na współpracę, ustalenie źródła majątku i wzmożone monitorowanie (§ 19).</div>` : ''}
    ${k.crbrRozbieznosc ? '<div class="card zolta">W karcie klienta zaznaczono brak wpisu w CRBR albo rozbieżność danych.</div>' : ''}
    <div class="card"><div class="card-title">Czynniki niskiego ryzyka (§ 5)</div>${lista(CZ_NISKIE, 'niskie', o.niskie)}</div>
    <div class="card"><div class="card-title">Czynniki podwyższonego ryzyka (§ 7)</div>${lista(CZ_PODW, 'podwyzszone', o.podwyzszone)}</div>
    <div class="card"><div class="card-title">Czynniki wysokiego ryzyka</div>${lista(CZ_WYS, 'wysokie', o.wysokie)}</div>
    <div class="card"><div class="card-title">Ocena behawioralna</div>${obszar('Jak zachowywał się klient, co wzbudziło wątpliwości', 'behawior', o.behawior, 'np. spokojny, dokumenty spójne, płatność przelewem z kredytu')}</div>

    <div class="card wynik" id="wynik"></div>
    <div id="ostrzezenia"></div>

    <div class="card"><div class="card-title">Grupa ryzyka (decyzja należy do Ciebie)</div>
      <div class="grupy">${Object.entries(GRUPY).map(([g, t]) => `<label class="grupa-opcja g${g}"><input type="radio" name="grupa" value="${g}" ${o.grupa === g ? 'checked' : ''}><span>${g === 'PEP' ? 'PEP' : g}. ${esc(t)}</span></label>`).join('')}</div>
      ${obszar('Uzasadnienie', 'uzasadnienie', o.uzasadnienie, 'Wymagane, gdy wybierasz inną grupę niż podpowiedź albo ryzyko jest podwyższone')}
      ${pole('Ocena ważna do', 'waznaDo', o.waznaDo, { typ: 'date' })}
      <p class="hint">Niskie i normalne: aktualizacja co 2 lata. Podwyższone, wysokie i PEP: co rok (§ 8).</p>
    </div>
    <div class="card"><div class="card-title">Zastosowane środki bezpieczeństwa (§ 9)</div>
      ${SRODKI.map(([kod, t]) => `<label class="przelacznik czynnik"><input type="checkbox" name="srodki" value="${kod}" ${o.srodki.includes(kod) ? 'checked' : ''}><span>${esc(t)}</span></label>`).join('')}
      <p class="hint">Jeśli któregoś środka nie da się zastosować, nie przeprowadzaj transakcji (§ 15) i rozważ zawiadomienie GIIF.</p>
    </div>
    <div class="przyciski dolne">
      <button type="button" class="btn" data-akcja="zapisz-szkic">💾 Zapisz szkic</button>
      <button type="submit" class="btn-primary">✅ Zatwierdź ocenę</button>
    </div>
    ${o.id ? '<button type="button" class="link-btn danger-link" data-akcja="usun-szkic">Usuń ten szkic</button>' : ''}
  </form>`;
};
function zbierzOcene() {
  const f = $('#f-ocena'); const o = { ...stan.szkic };
  for (const n of ['data', 'rola', 'nieruchomosc', 'wartosc', 'dataTransakcji', 'platnosc', 'zrodlo', 'cel', 'behawior', 'uzasadnienie', 'waznaDo']) o[n] = f.elements[n].value.trim();
  o.wartosc = o.wartosc.replace(/[^\d,.]/g, '').replace(',', '.');
  for (const n of ['niskie', 'podwyzszone', 'wysokie', 'srodki']) o[n] = $$(`input[name=${n}]:checked`, f).map((x) => x.value);
  const g = $('input[name=grupa]:checked', f); o.grupa = g ? g.value : '';
  return o;
}
PO.ocenaForm = () => {
  const f = $('#f-ocena'), k = klient(stan.szkic.klientId);
  let recznaWaznosc = !!stan.szkic.recznaWaznosc;
  let ostatniaPodp = null;
  const odswiez = (zmienionoGrupe) => {
    const o = zbierzOcene();
    const s = sugeruj(o, k);
    // grupa idzie za podpowiedzią, dopóki użytkownik jej sam nie zmieni
    if (!zmienionoGrupe && (!o.grupa || o.grupa === ostatniaPodp)) { const r = $(`input[name=grupa][value="${s.g}"]`, f); if (r) r.checked = true; o.grupa = s.g; }
    ostatniaPodp = s.g;
    if (!recznaWaznosc && o.grupa && o.data) f.elements.waznaDo.value = waznosc(o.data, o.grupa);
    $('#wynik').innerHTML = `<div class="card-title">Podpowiedź systemu</div><div class="wynik-grupa">${znaczek(s.g)}</div><p class="hint">Dlaczego: ${esc(s.dlaczego)}.</p>`;
    const ost = [];
    if (o.wysokie.includes('w_sankcje')) ost.push('⛔ <b>Lista sankcyjna: nie przeprowadzaj transakcji.</b> Zamroź wartości majątkowe i niezwłocznie zawiadom GIIF (§ 34).');
    if (o.wysokie.includes('w_podejrzenie')) ost.push('🚨 <b>Zawiadom GIIF</b> niezwłocznie, najpóźniej w 2 dni robocze od potwierdzenia podejrzenia (§ 25). Nie informuj klienta (§ 33).');
    if (o.platnosc === 'Gotówka' && !o.podwyzszone.includes('p_gotowka')) ost.push('💵 Wybrano płatność gotówką. Zaznacz czynnik „zapłata w gotówce”, jeśli dotyczy.');
    if (o.cel === '' ) ost.push('Uzupełnij cel i charakter transakcji (§ 9).');
    $('#ostrzezenia').innerHTML = ost.map((t) => `<div class="card czerwona">${t}</div>`).join('');
  };
  f.addEventListener('change', (e) => {
    if (e.target.name === 'waznaDo') { recznaWaznosc = true; stan.szkic.recznaWaznosc = true; return; }
    odswiez(e.target.name === 'grupa');
  });
  odswiez(false);
  // zapamiętaj sugestię dla wczytanego szkicu
  ostatniaPodp = sugeruj(zbierzOcene(), k).g;

  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const o = zbierzOcene(); const s = sugeruj(o, k);
    if (!o.grupa) { toast('Wybierz grupę ryzyka'); return; }
    if ((o.grupa !== s.g || ['3', '4', 'PEP'].includes(o.grupa)) && !o.uzasadnienie) { toast('Wpisz uzasadnienie'); f.elements.uzasadnienie.focus(); return; }
    if (!o.cel) { toast('Wpisz cel i charakter transakcji'); f.elements.cel.focus(); return; }
    if (!confirm('Zatwierdzić ocenę?\n\nPo zatwierdzeniu nie da się jej zmienić ani usunąć (§ 8 procedury). Każda zmiana to nowa ocena.')) return;
    o.sugerowana = s.g; o.zatwierdzona = true; o.zatwierdzono = new Date().toISOString();
    o.autor = baza.ustawienia.pracownik; o.przechowujDo = przechowuj(o);
    zapiszOcene(o);
    await zapisz(`Zatwierdzono ocenę ryzyka (${GRUPY[o.grupa]}): ${klientNazwa(k)}`);
    stan.szkic = null; toast('Ocena zatwierdzona'); pokaz('ocena', o.id);
  });
};
function zapiszOcene(o) {
  if (!o.id) { o.id = id(); baza.oceny.push(o); }
  else baza.oceny[baza.oceny.findIndex((x) => x.id === o.id)] = o;
}

WIDOKI.ocena = (oid) => {
  const o = baza.oceny.find((x) => x.id === oid);
  if (!o) return '<p>Nie ma takiej oceny.</p>';
  const k = klient(o.klientId);
  return `
  <div class="naglowek-widoku"><button class="link-btn" data-akcja="klient" data-id="${o.klientId}">← ${esc(klientNazwa(k))}</button><h2>Ocena ryzyka z ${fmt(o.data)}</h2></div>
  ${o.zatwierdzona ? `<div class="card"><div class="wynik-grupa">${znaczek(o.grupa)}</div>
     <p class="hint">Zatwierdził(a) ${esc(o.autor || '')} ${fmt((o.zatwierdzono || '').slice(0, 10))}. Ważna do <b>${fmt(o.waznaDo)}</b>. Przechowywać do ${fmt(o.przechowujDo)}.</p>
     <p class="hint">🔒 Zatwierdzonej oceny nie można zmienić ani usunąć (§ 8).</p>
     <div class="przyciski"><button class="btn-primary" data-akcja="druk-ocena" data-id="${o.id}">🖨 Drukuj / PDF</button><button class="btn" data-akcja="nowa-ocena" data-id="${o.klientId}" data-z="${o.id}">↻ Nowa ocena na podstawie tej</button></div></div>`
    : `<div class="card zolta">To szkic. <button class="btn-primary" data-akcja="edytuj-ocene" data-id="${o.id}">Dokończ</button></div>`}
  ${ocenaTresc(o, k)}`;
};
function ocenaTresc(o, k) {
  const l = (def, kody) => kody && kody.length ? `<ul>${kody.map((x) => `<li>${esc(etykieta(def, x))}</li>`).join('')}</ul>` : '<p class="hint">brak</p>';
  const w = (a, b) => b ? `<div class="dana"><span>${esc(a)}</span><b>${esc(b)}</b></div>` : '';
  return `<div class="card">
    ${w('Klient', klientNazwa(k))}${w('Rola', o.rola)}${w('Nieruchomość', o.nieruchomosc)}${w('Wartość', zl(o.wartosc))}${w('Data transakcji', fmt(o.dataTransakcji))}
    ${w('Forma płatności', o.platnosc)}${w('Źródło środków', o.zrodlo)}${w('Cel i charakter', o.cel)}${w('PEP', k && k.pep ? 'TAK' : 'nie')}
    <h4>Czynniki niskiego ryzyka</h4>${l(CZ_NISKIE, o.niskie)}
    <h4>Czynniki podwyższonego ryzyka</h4>${l(CZ_PODW, o.podwyzszone)}
    <h4>Czynniki wysokiego ryzyka</h4>${l(CZ_WYS, o.wysokie)}
    <h4>Ocena behawioralna</h4><p>${esc(o.behawior || 'brak uwag')}</p>
    <h4>Wynik</h4><p>Podpowiedź: ${esc(GRUPY[o.sugerowana] || '')}. Przyjęta grupa: <b>${esc(GRUPY[o.grupa] || '')}</b>.</p>
    ${o.uzasadnienie ? `<p>Uzasadnienie: ${esc(o.uzasadnienie)}</p>` : ''}
    <h4>Zastosowane środki bezpieczeństwa</h4>${l(SRODKI, o.srodki)}
  </div>`;
}

// ---------- REJESTRY ----------
const REJESTRY = [
  ['Listy sankcyjne', [
    ['Lista sankcyjna MSWiA (Polska)', 'https://www.gov.pl/web/mswia/lista-osob-i-podmiotow-objetych-sankcjami', 'osoby i firmy objęte sankcjami w związku z agresją Rosji na Ukrainę'],
    ['Mapa sankcji UE', 'https://www.sanctionsmap.eu/', 'wszystkie sankcje UE, wyszukiwanie po nazwisku i kraju'],
    ['Skonsolidowana lista sankcji finansowych UE', 'https://data.europa.eu/data/datasets/consolidated-list-of-persons-groups-and-entities-subject-to-eu-financial-sanctions', 'pełna lista osób i podmiotów'],
    ['Lista sankcyjna ONZ', 'https://main.un.org/securitycouncil/en/content/un-sc-consolidated-list', 'Rada Bezpieczeństwa ONZ']
  ]],
  ['Firmy i beneficjenci', [
    ['CRBR, beneficjenci rzeczywiści', 'https://crbr.podatki.gov.pl/adcrbr/#/wyszukaj', 'wyszukiwanie po NIP'],
    ['KRS', 'https://wyszukiwarka-krs.ms.gov.pl/', 'odpis aktualny spółki, zarząd, wspólnicy'],
    ['CEIDG (jednoosobowe działalności)', 'https://www.biznes.gov.pl/pl/wyszukiwarka-firm/', 'wyszukiwarka firm'],
    ['REGON (GUS)', 'https://wyszukiwarkaregon.stat.gov.pl/appBIR/index.aspx', 'dane rejestrowe'],
    ['Biała lista podatników VAT', 'https://www.podatki.gov.pl/wykaz-podatnikow-vat-wyszukiwarka', 'status VAT i rachunki bankowe'],
    ['VIES (VAT UE)', 'https://ec.europa.eu/taxation_customs/vies/', 'firmy z innych krajów UE']
  ]],
  ['Kraje wysokiego ryzyka', [
    ['FATF: czarna i szara lista', 'https://www.fatf-gafi.org/en/countries/black-and-grey-lists.html', 'państwa z brakami w systemach AML'],
    ['Komisja Europejska: państwa trzecie wysokiego ryzyka', 'https://finance.ec.europa.eu/financial-crime/anti-money-laundering-and-countering-financing-terrorism-international-level_en', 'lista KE']
  ]]
];
WIDOKI.rejestry = (kid) => {
  const k = kid ? klient(kid) : null;
  return `
  <div class="naglowek-widoku">${k ? `<button class="link-btn" data-akcja="klient" data-id="${k.id}">← ${esc(klientNazwa(k))}</button>` : ''}<h2>Rejestry i listy sankcyjne</h2></div>
  ${k ? `<div class="card"><div class="card-title">Sprawdzasz: ${esc(klientNazwa(k))}</div>
      <div class="przyciski">
        <button class="btn" data-akcja="kopiuj" data-tekst="${esc(klientNazwa(k))}">📋 Kopiuj nazwę</button>
        ${k.nip ? `<button class="btn" data-akcja="kopiuj" data-tekst="${esc(k.nip.replace(/\D/g, ''))}">📋 Kopiuj NIP</button>` : ''}
        ${(k.beneficjenci || []).filter((b) => b.nazwisko).map((b) => `<button class="btn" data-akcja="kopiuj" data-tekst="${esc(b.imie + ' ' + b.nazwisko)}">📋 ${esc(b.nazwisko)}</button>`).join('')}
      </div>
      <p class="hint">Skopiuj, otwórz rejestr i wklej w wyszukiwarkę. Wynik sprawdzenia zaznacz potem w ocenie ryzyka.</p></div>` : ''}
  ${REJESTRY.map(([grupa, lista]) => `<div class="card"><div class="card-title">${esc(grupa)}</div>
    ${lista.map(([n, url, opis]) => `<a class="wiersz link" href="${url}" target="_blank" rel="noopener noreferrer"><span>${esc(n)}<small>${esc(opis)}</small></span><span class="wiersz-prawa">↗</span></a>`).join('')}</div>`).join('')}
  <p class="hint">Aplikacja nie wysyła danych klientów do tych stron. Otwierasz je sam w przeglądarce.</p>`;
};

// ---------- USTAWIENIA ----------
WIDOKI.ustawienia = () => {
  const u = baza.ustawienia;
  return `
  <h2>Ustawienia</h2>
  <form class="card" id="f-podmiot"><div class="card-title">Dane biura (nagłówek wydruków)</div>
    ${pole('Nazwa', 'nazwa', u.podmiot.nazwa, { ph: 'np. RM Nieruchomości sp. z o.o.' })}
    ${pole('Adres', 'adres', u.podmiot.adres)}
    ${pole('NIP', 'nip', u.podmiot.nip, { inputmode: 'numeric' })}
    ${pole('Kto sporządza oceny (imię i nazwisko)', 'pracownik', u.pracownik)}
    <button type="submit" class="btn-primary wide">Zapisz</button>
  </form>
  <div class="card"><div class="card-title">Kopia zapasowa</div>
    <p class="hint">Dane są tylko w tym urządzeniu. Gdy zgubisz telefon albo wyczyścisz przeglądarkę, przepadną. Rób kopię co tydzień i trzymaj ją np. na OneDrive. Plik jest zaszyfrowany Twoim hasłem.</p>
    <p>Ostatnia kopia: <b>${u.ostatniaKopia ? fmt(u.ostatniaKopia) : 'nigdy'}</b></p>
    <button class="btn-primary wide" data-akcja="eksport">💾 Zrób kopię zapasową</button>
    <button class="btn wide" data-akcja="import">📂 Wczytaj kopię (zastąpi obecne dane)</button>
    <input type="file" id="plik-import" accept=".amlrm,application/json" hidden>
  </div>
  <form class="card" id="f-haslo"><div class="card-title">Zmiana hasła</div>
    ${pole('Nowe hasło (min. 8 znaków)', 'h1', '', { typ: 'password' })}${pole('Powtórz', 'h2', '', { typ: 'password' })}
    <button type="submit" class="btn wide">Zmień hasło</button>
  </form>
  <div class="card"><div class="card-title">Dziennik zmian</div>
    ${baza.dziennik.slice(0, 30).map((d) => `<div class="dziennik"><small>${esc(d.t.slice(0, 16).replace('T', ' '))}</small> ${esc(d.co)}</div>`).join('') || '<p class="hint">Pusto.</p>'}
  </div>
  <div class="card"><div class="card-title">Bezpieczeństwo</div>
    <ul class="lista-info">
      <li>Dane klientów nie opuszczają urządzenia. Aplikacja nie ma serwera, nie wysyła niczego do internetu (zablokowane w kodzie).</li>
      <li>Baza jest zaszyfrowana AES-256 kluczem z Twojego hasła. Hasła nie da się odzyskać: zapomniane hasło to utrata danych, zostaje tylko kopia.</li>
      <li>Aplikacja blokuje się sama po 5 minutach w tle.</li>
    </ul>
    <button class="btn danger wide" data-akcja="usun-wszystko">Usuń wszystkie dane z tego urządzenia</button>
  </div>`;
};
PO.ustawienia = () => {
  $('#f-podmiot').addEventListener('submit', async (e) => {
    e.preventDefault(); const d = zbierz(e.target);
    baza.ustawienia.podmiot = { nazwa: d.nazwa, adres: d.adres, nip: d.nip }; baza.ustawienia.pracownik = d.pracownik;
    await zapisz('Zmieniono dane biura'); toast('Zapisano');
  });
  $('#f-haslo').addEventListener('submit', async (e) => {
    e.preventDefault(); const d = zbierz(e.target);
    if (d.h1.length < 8) { toast('Hasło musi mieć co najmniej 8 znaków'); return; }
    if (d.h1 !== d.h2) { toast('Hasła się różnią'); return; }
    zapiszDziennik('Zmieniono hasło');
    await Sejf.zmienHaslo(d.h1, baza); e.target.reset(); toast('Hasło zmienione. Zrób nową kopię zapasową.');
  });
  $('#plik-import').addEventListener('change', async (e) => {
    const plik = e.target.files[0]; e.target.value = '';
    if (!plik) return;
    const haslo = prompt('Hasło, którym zaszyfrowana jest kopia:');
    if (!haslo) return;
    try {
      const dane = await Sejf.czytajKopie(JSON.parse(await plik.text()), haslo);
      if (!dane) { toast('Złe hasło do kopii'); return; }
      if (!confirm(`Kopia zawiera ${dane.klienci.length} klientów i ${dane.oceny.length} ocen. Zastąpić obecne dane?`)) return;
      baza = dane; await zapisz('Wczytano kopię zapasową'); toast('Kopia wczytana'); pokaz('pulpit');
    } catch (err) { toast(err.message); }
  });
};

// =====================================================================
// WYDRUKI
// =====================================================================
function drukuj(tytul, html) {
  const p = baza.ustawienia.podmiot;
  $('#druk').innerHTML = `<div class="dok">
    <div class="dok-glowa"><div><b>${esc(p.nazwa || '........................................')}</b><br>${esc(p.adres || '')}${p.nip ? '<br>NIP ' + esc(p.nip) : ''}</div><div>${fmt(dzis())}</div></div>
    <h1>${esc(tytul)}</h1>${html}</div>`;
  const stary = document.title; document.title = tytul;
  setTimeout(() => { window.print(); document.title = stary; }, 50);
}
const linia = (l, v) => `<tr><th>${esc(l)}</th><td>${esc(v || '')}</td></tr>`;
const podpis = (l) => `<div class="podpis"><div class="kreska"></div>${esc(l)}</div>`;

function drukKarta(k) {
  const o = ostatniaZatw(k.id); const r = k.repr || {};
  const osoba = k.typ === 'osoba';
  drukuj('Karta identyfikacji i weryfikacji klienta', `
    <p class="mala">Na podstawie ustawy z dnia 1 marca 2018 r. o przeciwdziałaniu praniu pieniędzy oraz finansowaniu terroryzmu i wewnętrznej procedury AML (§ 11 do 14).</p>
    <h2>Klient</h2><table>${osoba
      ? linia('Imię i nazwisko', klientNazwa(k)) + linia('PESEL', k.pesel) + linia('Data urodzenia', fmt(k.dataUr)) + linia('Państwo urodzenia', k.krajUr) + linia('Obywatelstwo', k.obywatelstwo) + linia('Dokument tożsamości', [k.dokTyp, k.dokNr].filter(Boolean).join(', ')) + linia('Adres zamieszkania', k.adres) + (k.dzNip ? linia('Działalność gospodarcza', [k.dzNazwa, 'NIP ' + k.dzNip, k.dzAdres].filter(Boolean).join(', ')) : '')
      : linia('Nazwa', k.nazwa) + linia('Forma organizacyjna', k.forma) + linia('NIP', k.nip) + linia('REGON', k.regon) + linia('KRS', k.krs) + linia('Adres siedziby', k.siedziba) + (k.krajRej ? linia('Państwo rejestracji', k.krajRej) : '')}
      ${linia('Telefon, e-mail', [k.telefon, k.email].filter(Boolean).join(', '))}${linia('Klient zagraniczny', k.zagraniczny ? 'tak' : 'nie')}${linia('PEP', k.pep ? 'TAK. ' + (k.pepOpis || '') : 'nie')}</table>
    ${k.maRepr && r.nazwisko ? `<h2>${osoba ? 'Pełnomocnik' : 'Osoba reprezentująca'}</h2><table>${linia('Imię i nazwisko', [r.imie, r.nazwisko].join(' '))}${linia('PESEL lub data urodzenia', r.pesel)}${linia('Obywatelstwo', r.obywatelstwo)}${r.krajUr ? linia('Państwo urodzenia', r.krajUr) : ''}${linia('Podstawa umocowania', r.umocowanie)}</table>` : ''}
    ${!osoba ? `<h2>Beneficjenci rzeczywiści</h2><table class="siatka-t"><tr><th>Imię i nazwisko</th><th>Obywatelstwo</th><th>PESEL / data ur.</th><th>Rodzaj kontroli</th></tr>
      ${(k.beneficjenci || []).filter((b) => b.nazwisko).map((b) => `<tr><td>${esc(b.imie + ' ' + b.nazwisko)}</td><td>${esc(b.obywatelstwo)}</td><td>${esc(b.pesel)}</td><td>${esc(b.kontrola)}</td></tr>`).join('') || '<tr><td colspan="4">brak danych</td></tr>'}</table>
      <p class="mala">${k.crbrRozbieznosc ? 'Stwierdzono brak wpisu w CRBR albo rozbieżność danych.' : 'Dane sprawdzone w CRBR.'}</p>` : ''}
    <h2>Weryfikacja</h2>
    <table>${linia('Sposób weryfikacji tożsamości', osoba ? 'okazany dokument tożsamości: ' + [k.dokTyp, k.dokNr].filter(Boolean).join(' ') : 'odpis z KRS lub CEIDG, CRBR, dokument tożsamości osoby reprezentującej')}
      ${o ? linia('Ocena ryzyka', `${GRUPY[o.grupa]} (z ${fmt(o.data)}, ważna do ${fmt(o.waznaDo)})`) : linia('Ocena ryzyka', 'nie sporządzono')}
      ${o ? linia('Zastosowane środki', o.srodki.map((x) => etykieta(SRODKI, x)).join('; ')) : ''}
      ${linia('Przechowywać do', o ? fmt(o.przechowujDo) : '5 lat od końca roku zakończenia współpracy')}</table>
    <div class="podpisy">${podpis('data i podpis osoby weryfikującej: ' + (baza.ustawienia.pracownik || ''))}</div>`);
}

function drukOswiadczenie(k) {
  const osoba = k.typ === 'osoba';
  const p = baza.ustawienia.podmiot;
  const kratka = '<span class="kratka"></span>';
  drukuj('Oświadczenie klienta', `
    <table>${osoba ? linia('Imię i nazwisko', klientNazwa(k)) + linia('PESEL / data urodzenia', k.pesel || fmt(k.dataUr)) : linia('Firma', k.nazwa) + linia('NIP', k.nip) + linia('Osoba składająca oświadczenie', [k.repr && k.repr.imie, k.repr && k.repr.nazwisko].filter(Boolean).join(' '))}</table>
    <h2>1. Status osoby zajmującej eksponowane stanowisko polityczne (PEP)</h2>
    <p>Oświadczam, że ${osoba ? 'jestem' : 'beneficjent rzeczywisty lub osoba reprezentująca jest'} (zaznacz właściwe):</p>
    <p>${kratka} osobą zajmującą eksponowane stanowisko polityczne<br>${kratka} członkiem rodziny takiej osoby (małżonek lub partner, dziecko i jego małżonek lub partner, rodzic)<br>${kratka} osobą znaną jako bliski współpracownik takiej osoby<br>${kratka} <b>żadne z powyższych</b></p>
    <p>Jeśli tak, stanowisko i funkcja: ..................................................................................................</p>
    <p class="mala">Osoby PEP to m.in.: szefowie państw i rządów, ministrowie, wiceministrowie, sekretarze i podsekretarze stanu, posłowie, senatorowie, członkowie zarządów partii, sędziowie SN, TK, NSA, WSA i sądów apelacyjnych, członkowie zarządu NBP, ambasadorzy, wyżsi oficerowie, członkowie zarządów i rad nadzorczych spółek Skarbu Państwa, dyrektorzy organizacji międzynarodowych i dyrektorzy generalni urzędów centralnych i wojewódzkich.</p>
    ${!osoba ? `<h2>2. Beneficjenci rzeczywiści</h2><p>Oświadczam, że beneficjentami rzeczywistymi firmy są:</p>
      <table class="siatka-t"><tr><th>Imię i nazwisko</th><th>Obywatelstwo</th><th>PESEL / data ur.</th><th>Rodzaj kontroli</th></tr>
      ${[0, 1, 2].map((i) => { const b = (k.beneficjenci || []).filter((x) => x.nazwisko)[i] || {}; return `<tr class="wys"><td>${esc([b.imie, b.nazwisko].filter(Boolean).join(' '))}</td><td>${esc(b.obywatelstwo)}</td><td>${esc(b.pesel)}</td><td>${esc(b.kontrola)}</td></tr>`; }).join('')}</table>` : ''}
    <h2>${osoba ? '2' : '3'}. Źródło pochodzenia środków</h2>
    <p>Środki na transakcję pochodzą z: ${kratka} wynagrodzenia lub działalności ${kratka} sprzedaży nieruchomości ${kratka} kredytu bankowego ${kratka} darowizny lub spadku ${kratka} innego źródła: .........................................</p>
    <p>Oświadczam, że działam we własnym imieniu i na własny rachunek ${kratka} tak ${kratka} nie, w imieniu: ..............................................</p>
    <p class="klauzula">Jestem świadomy odpowiedzialności karnej za złożenie fałszywego oświadczenia.</p>
    <div class="podpisy">${podpis('miejscowość i data')}${podpis('czytelny podpis klienta')}</div>
    <h2>Informacja o przetwarzaniu danych</h2>
    <p class="mala">Administratorem danych jest ${esc(p.nazwa || '....................')}${p.adres ? ', ' + esc(p.adres) : ''}. Dane, w tym kopia lub dane z dokumentu tożsamości, są przetwarzane w celu wykonania obowiązków z ustawy z dnia 1 marca 2018 r. o przeciwdziałaniu praniu pieniędzy oraz finansowaniu terroryzmu (art. 6 ust. 1 lit. c RODO). Podanie danych jest wymogiem ustawowym, bez nich nie możemy przeprowadzić transakcji. Dane przechowujemy przez 5 lat od końca roku, w którym zakończyła się współpraca albo przeprowadzono transakcję, i udostępniamy wyłącznie uprawnionym organom, w tym Generalnemu Inspektorowi Informacji Finansowej. Przysługuje Pani/Panu prawo dostępu do danych, ich sprostowania oraz skargi do Prezesa UODO, w granicach przewidzianych w tej ustawie.</p>`);
}

function drukOcena(o) {
  const k = klient(o.klientId);
  drukuj('Ocena ryzyka prania pieniędzy i finansowania terroryzmu', `
    <p class="mala">Sporządzona na podstawie § 4 do 8 wewnętrznej procedury AML. Data oceny: ${fmt(o.data)}. Ważna do: ${fmt(o.waznaDo)}. Przechowywać do: ${fmt(o.przechowujDo)}.</p>
    ${ocenaTresc(o, k).replace(/class="card"/, 'class="dok-tresc"')}
    <div class="podpisy">${podpis('data i podpis: ' + (o.autor || ''))}</div>`);
}

// =====================================================================
// AKCJE (kliknięcia)
// =====================================================================
const AKCJE = {
  nav: (d) => pokaz(d.cel, d.id || null),
  klient: (d) => pokaz('klient', d.id),
  nowy: (d) => { stan.szkic = pustyKlient(d.typ); pokaz('klientForm'); },
  edytuj: (d) => { stan.szkic = JSON.parse(JSON.stringify(klient(d.id))); pokaz('klientForm'); },
  'dodaj-ben': () => { stan.szkic = zbierzKlienta(); stan.szkic.beneficjenci.push({}); pokaz('klientForm'); },
  'usun-ben': (d) => { stan.szkic = zbierzKlienta(); stan.szkic.beneficjenci.splice(+d.i, 1); pokaz('klientForm'); },
  ocena: (d) => pokaz('ocena', d.id),
  'nowa-ocena': (d) => {
    const k = klient(d.id);
    const zrodlo = d.z ? baza.oceny.find((x) => x.id === d.z) : null;
    const o = zrodlo
      ? { ...JSON.parse(JSON.stringify(zrodlo)), id: null, zatwierdzona: false, zatwierdzono: null, data: dzis(), uzasadnienie: '', recznaWaznosc: false, poprzednia: zrodlo.id }
      : { id: null, klientId: k.id, data: dzis(), rola: 'Kupujący', platnosc: PLATNOSCI[0], niskie: [], podwyzszone: [], wysokie: [], srodki: [], grupa: '' };
    if (!zrodlo) {
      if (k.zagraniczny === false || !k.zagraniczny) { if ((k.obywatelstwo || '').toLowerCase().startsWith('pol') || k.typ === 'firma') o.niskie.push('n_ue'); }
      if (k.crbrRozbieznosc) o.podwyzszone.push('p_struktura');
      o.srodki = domyslneSrodki(k, o);
    }
    stan.szkic = o; pokaz('ocenaForm');
  },
  'edytuj-ocene': (d) => { stan.szkic = JSON.parse(JSON.stringify(baza.oceny.find((x) => x.id === d.id))); pokaz('ocenaForm'); },
  'zapisz-szkic': async () => {
    const o = zbierzOcene(); zapiszOcene(o);
    await zapisz('Zapisano szkic oceny: ' + klientNazwa(klient(o.klientId)));
    stan.szkic = null; toast('Szkic zapisany'); pokaz('klient', o.klientId);
  },
  'usun-szkic': async () => {
    const o = stan.szkic; if (!o.id || !confirm('Usunąć szkic oceny?')) return;
    baza.oceny = baza.oceny.filter((x) => x.id !== o.id || x.zatwierdzona);
    await zapisz('Usunięto szkic oceny'); stan.szkic = null; pokaz('klient', o.klientId);
  },
  'druk-ocena': (d) => drukOcena(baza.oceny.find((x) => x.id === d.id)),
  'druk-karta': (d) => drukKarta(klient(d.id)),
  'druk-oswiadczenie': (d) => drukOswiadczenie(klient(d.id)),
  kopiuj: async (d) => { try { await navigator.clipboard.writeText(d.tekst); toast('Skopiowano: ' + d.tekst); } catch (e) { prompt('Skopiuj:', d.tekst); } },
  archiwum: async (d) => {
    const k = klient(d.id); k.archiwum = !k.archiwum;
    await zapisz((k.archiwum ? 'Zakończono współpracę: ' : 'Przywrócono klienta: ') + klientNazwa(k)); pokaz('klient', k.id);
  },
  'usun-klienta': async (d) => {
    const k = klient(d.id);
    if (!confirm(`Usunąć klienta ${klientNazwa(k)} i jego oceny? Tego nie da się cofnąć.`)) return;
    baza.klienci = baza.klienci.filter((x) => x.id !== k.id); baza.oceny = baza.oceny.filter((o) => o.klientId !== k.id);
    await zapisz('Usunięto klienta: ' + klientNazwa(k)); pokaz('klienci');
  },
  eksport: async () => {
    baza.ustawienia.ostatniaKopia = dzis(); await zapisz('Zrobiono kopię zapasową');
    const paczka = await Sejf.kopia();
    const nazwa = `AML-RM-kopia-${dzis()}.amlrm`;
    const plik = new File([JSON.stringify(paczka)], nazwa, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [plik] })) {
      try { await navigator.share({ files: [plik], title: nazwa }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(plik); a.download = nazwa; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('Kopia zapisana: ' + nazwa);
  },
  import: () => $('#plik-import').click(),
  'usun-wszystko': async () => {
    if (!confirm('Usunąć WSZYSTKIE dane AML z tego urządzenia?')) return;
    if (prompt('Na pewno? Wpisz USUŃ') !== 'USUŃ') return;
    await Sejf.usunWszystko(); baza = null; location.reload();
  }
};
$('#widok').addEventListener('click', (e) => {
  const b = e.target.closest('[data-akcja]'); if (!b) return;
  const f = AKCJE[b.dataset.akcja]; if (!f) return;
  e.preventDefault(); f(b.dataset);
});
$$('#nawigacja button').forEach((b) => b.addEventListener('click', () => pokaz(b.dataset.nav)));

// =====================================================================
// BLOKADA HASŁEM
// =====================================================================
let tryb = 'otworz'; // albo 'zaloz'
async function ekranBlokady() {
  baza = null; Sejf.zamknij();
  $('#widok').innerHTML = ''; $('#druk').innerHTML = '';
  $('#ekran-app').classList.remove('active'); $('#nawigacja').hidden = true; $('#zablokuj-btn').hidden = true;
  $('#ekran-blokada').classList.add('active');
  tryb = (await Sejf.istnieje()) ? 'otworz' : 'zaloz';
  $('#blk-tytul').textContent = tryb === 'zaloz' ? 'Ustaw hasło do AML' : 'AML RM';
  $('#blk-opis').textContent = tryb === 'zaloz'
    ? 'Hasło szyfruje dane klientów w tym urządzeniu. Minimum 8 znaków. Zapamiętaj je: nie da się go odzyskać.'
    : 'Wpisz hasło, żeby otworzyć dane klientów.';
  $('#blk-powtorz-box').hidden = tryb !== 'zaloz';
  $('#blk-ok').textContent = tryb === 'zaloz' ? 'Ustaw hasło' : 'Otwórz';
  $('#blk-import').hidden = tryb !== 'zaloz';
  $('#blk-blad').hidden = true; $('#blk-haslo').value = ''; $('#blk-haslo2').value = '';
  setTimeout(() => $('#blk-haslo').focus(), 50);
}
function wejdz() {
  $('#ekran-blokada').classList.remove('active');
  $('#ekran-app').classList.add('active'); $('#nawigacja').hidden = false; $('#zablokuj-btn').hidden = false;
  baza.ustawienia = Object.assign(nowaBaza().ustawienia, baza.ustawienia);
  baza.dziennik = baza.dziennik || [];
  pokaz('pulpit');
}
const blad = (t) => { $('#blk-blad').textContent = t; $('#blk-blad').hidden = false; };
async function zatwierdzHaslo() {
  const h = $('#blk-haslo').value;
  const btn = $('#blk-ok'); btn.disabled = true;
  try {
    if (tryb === 'zaloz') {
      if (h.length < 8) return blad('Hasło musi mieć co najmniej 8 znaków.');
      if (h !== $('#blk-haslo2').value) return blad('Hasła się różnią.');
      baza = nowaBaza(); zapiszDziennik('Założono bazę AML');
      await Sejf.zaloz(h, baza); wejdz();
    } else {
      btn.textContent = 'Sprawdzam…';
      const d = await Sejf.otworz(h);
      if (!d) { btn.textContent = 'Otwórz'; return blad('Złe hasło.'); }
      baza = d; wejdz();
    }
  } finally { btn.disabled = false; if (tryb === 'otworz') btn.textContent = 'Otwórz'; }
}
$('#blk-ok').addEventListener('click', zatwierdzHaslo);
$('#blk-haslo').addEventListener('keydown', (e) => { if (e.key === 'Enter' && tryb === 'otworz') zatwierdzHaslo(); });
$('#blk-haslo2').addEventListener('keydown', (e) => { if (e.key === 'Enter') zatwierdzHaslo(); });
$('#zablokuj-btn').addEventListener('click', ekranBlokady);
$('#blk-import').addEventListener('click', () => $('#blk-plik').click());
$('#blk-plik').addEventListener('change', async (e) => {
  const plik = e.target.files[0]; e.target.value = ''; if (!plik) return;
  const h = $('#blk-haslo').value;
  if (!h) return blad('Najpierw wpisz hasło, którym zaszyfrowana jest kopia.');
  try {
    const d = await Sejf.czytajKopie(JSON.parse(await plik.text()), h);
    if (!d) return blad('Złe hasło do tej kopii.');
    baza = d; await Sejf.zaloz(h, baza); toast('Kopia wczytana'); wejdz();
  } catch (err) { blad(err.message); }
});

// automatyczna blokada: 5 minut w tle albo 15 minut bez dotknięcia
let ukrytoO = 0, ostatniRuch = Date.now();
document.addEventListener('visibilitychange', () => {
  if (document.hidden) ukrytoO = Date.now();
  else if (baza && ukrytoO && Date.now() - ukrytoO > 5 * 60000) ekranBlokady();
});
['pointerdown', 'keydown'].forEach((ev) => document.addEventListener(ev, () => { ostatniRuch = Date.now(); }, { passive: true }));
setInterval(() => { if (baza && Date.now() - ostatniRuch > 15 * 60000) ekranBlokady(); }, 30000);

ekranBlokady();

// ---------- OFFLINE / AKTUALIZACJE ----------
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
async function sprawdzWersje() {
  try {
    const t = await (await fetch('app.js?spr=' + Date.now(), { cache: 'no-store' })).text();
    const m = t.match(/const WERSJA = (\d+);/);
    if (!m || +m[1] <= WERSJA) return;
    $('#aktualizacja').hidden = false;
  } catch (e) { /* brak zasięgu */ }
}
$('#aktualizacja-btn').addEventListener('click', () => {
  if (stan.szkic && !confirm('Niezapisany formularz przepadnie. Odświeżyć?')) return;
  location.reload();
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) sprawdzWersje(); });
sprawdzWersje();
