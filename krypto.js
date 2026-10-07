// RM NIERUCHOMOŚCI, AML: sejf na dane klientów
// Cała baza (klienci, oceny, ustawienia) to jeden JSON zaszyfrowany AES-256-GCM.
// Klucz liczony z hasła (PBKDF2-SHA-256, 600 000 powtórzeń), nigdzie nie zapisywany.
// W IndexedDB leży tylko szyfrogram, sól i IV. Bez hasła danych nie da się odczytać.
'use strict';

const Sejf = (() => {
  const enc = new TextEncoder(), dec = new TextDecoder();
  const ITER = 600000;
  const DB = 'aml-rm', STORE = 'sejf', KLUCZ = 'baza';

  const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const zb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

  async function kluczZHasla(haslo, sol) {
    const baza = await crypto.subtle.importKey('raw', enc.encode(haslo), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: sol, iterations: ITER, hash: 'SHA-256' },
      baza, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  async function zaszyfruj(klucz, sol, obiekt) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, klucz, enc.encode(JSON.stringify(obiekt))));
    return { format: 'aml-rm', wersja: 1, iter: ITER, sol: b64(sol), iv: b64(iv), dane: b64(ct) };
  }

  async function odszyfruj(klucz, paczka) {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: zb64(paczka.iv) }, klucz, zb64(paczka.dane));
    return JSON.parse(dec.decode(pt));
  }

  // ---------- IndexedDB ----------
  function otworz() {
    return new Promise((ok, err) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => ok(r.result);
      r.onerror = () => err(r.error);
    });
  }
  async function czytaj() {
    const db = await otworz();
    return new Promise((ok, err) => {
      const r = db.transaction(STORE).objectStore(STORE).get(KLUCZ);
      r.onsuccess = () => ok(r.result || null); r.onerror = () => err(r.error);
    });
  }
  async function pisz(paczka) {
    const db = await otworz();
    return new Promise((ok, err) => {
      const t = db.transaction(STORE, 'readwrite');
      t.objectStore(STORE).put(paczka, KLUCZ);
      t.oncomplete = () => ok(); t.onerror = () => err(t.error);
    });
  }
  async function wyczysc() {
    const db = await otworz();
    return new Promise((ok, err) => {
      const t = db.transaction(STORE, 'readwrite');
      t.objectStore(STORE).delete(KLUCZ);
      t.oncomplete = () => ok(); t.onerror = () => err(t.error);
    });
  }

  // ---------- stan sesji (klucz tylko w pamięci) ----------
  let klucz = null, sol = null;

  return {
    async istnieje() { return !!(await czytaj()); },

    async zaloz(haslo, dane) {
      sol = crypto.getRandomValues(new Uint8Array(16));
      klucz = await kluczZHasla(haslo, sol);
      await pisz(await zaszyfruj(klucz, sol, dane));
    },

    // zwraca dane albo null przy złym haśle
    async otworz(haslo) {
      const p = await czytaj();
      if (!p) return null;
      const s = zb64(p.sol), k = await kluczZHasla(haslo, s);
      try { const d = await odszyfruj(k, p); klucz = k; sol = s; return d; } catch (e) { return null; }
    },

    async zapisz(dane) {
      if (!klucz) throw new Error('Sejf zamknięty');
      await pisz(await zaszyfruj(klucz, sol, dane));
    },

    zamknij() { klucz = null; sol = null; },
    otwarty() { return !!klucz; },

    // kopia zapasowa: ta sama paczka co w bazie (zaszyfrowana tym samym hasłem)
    async kopia() { return czytaj(); },

    // odczyt kopii z pliku; zwraca dane albo null przy złym haśle
    async czytajKopie(paczka, haslo) {
      if (!paczka || paczka.format !== 'aml-rm') throw new Error('To nie jest plik kopii AML RM');
      const k = await kluczZHasla(haslo, zb64(paczka.sol));
      try { return await odszyfruj(k, paczka); } catch (e) { return null; }
    },

    async zmienHaslo(noweHaslo, dane) { await this.zaloz(noweHaslo, dane); },
    async usunWszystko() { await wyczysc(); this.zamknij(); }
  };
})();
