# AML RM

PWA do obowiazkow AML biura (prostsza wersja aplikacji WEB AML Grupy Format, zbudowana 07.10.2026).
Podstawa merytoryczna: "Procedura AML - nieruchomosci" z Grupy Format (§ 3 do 34), poradnik oceny ryzyka.

- Karta klienta: osoba (imie, nazwisko, PESEL z kontrola sumy i data urodzenia z PESEL, panstwo urodzenia, obywatelstwo, dokument, adres, JDG) albo firma (nazwa, forma, NIP z kontrola, REGON, KRS, siedziba, beneficjenci rzeczywisci, osoba reprezentujaca). Pelnomocnik, klient zagraniczny, PEP z opisem.
- Ocena ryzyka: transakcja (rola, nieruchomosc, wartosc, data, platnosc, zrodlo srodkow, cel), czynniki niskie (§ 5), podwyzszone (§ 7), wysokie (kraje, sankcje, podejrzenie), ocena behawioralna. Podpowiedz grupy: wysoki czynnik = 4, PEP = PEP, 3+ podwyzszone = 4, 1-2 = 3, kryterium niskie = 1, inaczej 2. Decyzja nalezy do uzytkownika (inna grupa niz podpowiedz albo 3/4/PEP wymaga uzasadnienia).
- Waznosc: grupa 1 i 2 na 2 lata, 3, 4 i PEP na rok (§ 8). Przechowywanie do 31.12 roku (rok transakcji + 5) (§ 20).
- Zatwierdzona ocena jest zablokowana (bez edycji i usuwania, § 8), zmiana = nowa ocena na bazie poprzedniej. Klienta z zatwierdzona ocena nie da sie usunac przed koncem przechowywania; jest archiwum ("zakoncz wspolprace").
- Ostrzezenia: lista sankcyjna (nie przeprowadzac, § 34), podejrzenie (GIIF w 2 dni robocze, § 25, tajemnica § 33), PEP (§ 19).
- Pulpit: oceny wygasle i wygasajace w 30 dni, klienci bez oceny, szkice, zawiadomienia GIIF, minione przechowywanie, przypomnienie o kopii (co 14 dni), brak danych biura.
- Wydruki (window.print, na iPhonie "Drukuj" -> PDF): oswiadczenie klienta (PEP, zrodlo srodkow, beneficjenci, klauzula karna, informacja RODO), karta identyfikacji i weryfikacji, ocena ryzyka.
- Rejestry: linki do list sankcyjnych (MSWiA, UE, ONZ), CRBR, KRS, CEIDG, REGON, biala lista, VIES, FATF, lista KE + kopiowanie NIP/nazw klienta.
- Dziennik zmian (500 ostatnich wpisow).

## Bezpieczenstwo
- Zero serwera i bibliotek. CSP: connect-src 'self', script-src 'self'. Nic nie wychodzi z urzadzenia.
- Cala baza to jeden JSON zaszyfrowany AES-256-GCM w IndexedDB, klucz z hasla PBKDF2-SHA-256 600 000 powtorzen (krypto.js). Klucz tylko w pamieci.
- Blokada po 5 min w tle albo 15 min bez dotkniecia. Hasla nie da sie odzyskac.
- Kopia zapasowa = ten sam zaszyfrowany plik .amlrm (udostepnianie na iPhonie albo pobranie), wczytanie przy zakladaniu albo w Ustawieniach.
- Dane sa per urzadzenie i per przegladarka: telefon i komputer to osobne bazy (przenoszenie kopia).

## Testy 07.10.2026
Headless Chrome (playwright, 390x844): zalozenie bazy, klient z PESEL testowym, ocena (podpowiedzi: niskie -> normalne -> podwyzszone -> wysokie, waznosc 2 lata / 1 rok), zatwierdzenie, blokada, zle haslo odrzucone, ponowne otwarcie, w IndexedDB brak jawnego PESEL, trzy wydruki. Linki do rejestrow sprawdzone curl.

## Wydanie
Przy kazdej zmianie podbij razem: `WERSJA` w app.js, `?v=` w index.html, `CACHE` w sw.js.
Ikony: `python generate-icons.py`.
