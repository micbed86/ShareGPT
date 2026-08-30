# ShareGPT Export

Rozszerzenie Manifest V3 dla Chrome, Edge, Brave i innych przeglądarek Chromium. Dodaje funkcje udostępniania i eksportu bezpośrednio do interfejsu `chatgpt.com`. Nie ma popupu ani osobnego menu w pasku przeglądarki.

## Co robi

- dodaje dyskretną opcję „Udostępnij / eksportuj” do nagłówka bieżącej rozmowy;
- dodaje przycisk z trzema kropkami pod każdą wypowiedzią użytkownika i asystenta;
- kopiuje całą rozmowę albo jedną wypowiedź do schowka w dokładnie tym samym formacie Markdown co eksport `.md`;
- udostępnia całą rozmowę albo jedną wypowiedź jako statyczny HTML przez `ship.page`;
- automatycznie kopiuje gotowy link i pokazuje go w modalu;
- eksportuje całą rozmowę albo jedną wypowiedź lokalnie jako HTML lub Markdown;
- tworzy jeden responsywny HTML: układ desktopowy zachowuje rytm bieżącego czatu, a reguły mobile dostosowują go do wąskiego ekranu;
- przejmuje jasny lub ciemny motyw, kolory strony, tekstu i dymka użytkownika z aktualnej rozmowy;
- próbuje osadzić obrazy z domen OpenAI jako `data:`. Jeśli obraz nie może zostać pobrany, pozostawia bezpieczny adres HTTPS jako fallback.

## Instalacja lokalna

1. Otwórz `chrome://extensions` w Chrome lub `edge://extensions` w Edge.
2. Włącz **Tryb dewelopera**.
3. Kliknij **Załaduj rozpakowane**.
4. Wskaż katalog projektu zawierający `manifest.json`.
5. Odśwież otwartą kartę `https://chatgpt.com`.

Możesz też zbudować ZIP poleceniem:

```powershell
npm run package
```

Gotowa paczka pojawi się w `dist/sharegpt-export-v1.1.0.zip`. Do instalacji deweloperskiej najwygodniejszy jest jednak katalog rozpakowany.

## Użycie

### Cała rozmowa

W nagłówku rozmowy wybierz **Udostępnij / eksportuj**, a następnie:

- **Udostępnij rozmowę**;
- **Kopiuj rozmowę jako Markdown**;
- **Eksportuj rozmowę jako HTML**;
- **Eksportuj rozmowę jako Markdown**.

### Jedna wypowiedź

Pod wybraną wypowiedzią kliknij subtelny przycisk z trzema kropkami. Dostępne są udostępnianie, kopiowanie Markdown oraz eksport HTML i Markdown, ograniczone do tej wypowiedzi.

## Publikacja i prywatność

Udostępnianie wymaga potwierdzenia w modalu. Dopiero wtedy treść wygenerowanego HTML trafia do `https://ship.page/deploy`.

- darmowy, anonimowy link działa do 7 dni;
- dostęp ma każda osoba znająca link;
- link jest capability URL, nie kontem ani szyfrowanym sejfem;
- anonimowa publikacja jest niezmienna i wtyczka nie ma mechanizmu wcześniejszego usunięcia;
- eksport HTML i Markdown nie wysyła rozmowy na serwer;
- wtyczka nie zapisuje historii rozmów, linków, kluczy ani danych logowania.

Nie udostępniaj w ten sposób danych medycznych, haseł, kluczy API ani innych danych wrażliwych.

Więcej szczegółów znajduje się w [PRIVACY.md](PRIVACY.md).

## Zakres statycznego HTML

Eksport zachowuje strukturę wypowiedzi, akapity, nagłówki, listy, tabele, cytaty, kod, linki, obrazy i wzory matematyczne dostępne w DOM. Plik celowo nie przenosi skryptów ChatGPT, formularza wiadomości, menu, przycisków oceniania, odtwarzaczy ani innych aktywnych kontrolek. Jest statyczny, responsywny i zabezpieczony restrykcyjnym CSP.

ChatGPT jest aplikacją rozwijaną niezależnie i jego DOM może się zmienić. Wtyczka używa semantycznych atrybutów `data-message-author-role`, `data-message-id`, `article` i `data-testid` zamiast generowanych klas, ale po większej zmianie ChatGPT selektory mogą wymagać aktualizacji.

## Weryfikacja

```powershell
npm run verify
```

Polecenie sprawdza składnię JavaScript, manifest MV3, brak zdalnych skryptów i dynamicznego wykonywania kodu oraz uruchamia testy generatora eksportu, polityki URL i walidacji odpowiedzi hostingu.

## Struktura

```text
manifest.json
src/
  background-core.js  # walidacja hostów, rozmiarów i odpowiedzi API
  background.js       # publikacja i osadzanie obrazów
  exporter.js         # ekstrakcja, sanitizacja, HTML i Markdown
  content.js          # integracja z dynamicznym UI ChatGPT
  content.css         # minimalistyczne kontrolki, menu i modal
tests/
tools/
```
