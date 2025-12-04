# Specyfikacja Funkcjonalna Projektu "Thingy"

## 1. Przegląd Projektu
**Thingy** to zaawansowane narzędzie CLI (Command Line Interface) służące do zarządzania produktywnością dewelopera. Aplikacja integruje zarządzanie zadaniami, śledzenie czasu (Timer/Pomodoro), notatki oraz analizę produktywności bezpośrednio w terminalu. Narzędzie działa w trybie interaktywnym (menu wyboru) oraz przyjmuje argumenty wiersza poleceń.

## 2. Architektura Danych
Aplikacja opiera się na strukturze plików JSON przechowywanych lokalnie, z obsługą wielu profili użytkowników.

*   **Lokalizacja Danych:** `profiles/<ID_PROFILU>/`
*   **Główne Pliki:**
    *   `tasks.json`: Lista zadań, statusy, estymacje, spędzony czas.
    *   `notes.json`: Proste notatki tekstowe.
    *   `productivity.json`: Dzienny rejestr czasu pracy i wykonanych zadań.
    *   `user.json`: Konfiguracja planu dnia i odznaki (gamifikacja).
    *   `config.json`: Globalna konfiguracja (aktywny profil, dane chmury, ustawienia Pomodoro).

## 3. Główne Moduły

### 3.1. Zarządzanie Zadaniami (`feature/tasks.js`)
System pozwala na pełny cykl życia zadania (CRUD).

*   **Atrybuty Zadania:** ID, Nazwa, Link (np. do Jira/GitHub), Estymacja (h), Status, Data utworzenia, Licznik Pomodoro, Czas spędzony.
*   **Statusy:**
    *   ⚪️ `ToDo` (0)
    *   🔵 `In Progress` (1)
    *   🟠 `In Review` (2)
    *   🟢 `Done` (3)
*   **Funkcje:**
    *   **Dodawanie:** Interaktywny formularz (Nazwa, Link, Estymacja).
    *   **Wyświetlanie:** Lista z podziałem na statusy. Ostrzeganie o przekroczeniu estymacji. Pasek postępu dla zadań w trakcie.
    *   **Wyszukiwanie:** Po ID lub frazie (w nazwie/linku).
    *   **Zmiana Statusu:** Przenoszenie zadań między stanami (np. z ToDo do InProgress).

### 3.2. Zarządzanie Czasem (`feature/pomodoro.js`, `feature/timer.js`)
Dwa tryby śledzenia czasu pracy, które automatycznie aktualizują statystyki zadań.

*   **Pomodoro:**
    *   Odliczanie w dół (domyślnie 25 min, konfigurowalne: 15/25/45 min).
    *   Możliwość przypisania sesji do konkretnego zadania (ID).
    *   Powiadomienia systemowe (`node-notifier`) po zakończeniu.
    *   Wizualizacja postępu w terminalu.
*   **Timer (Stoper):**
    *   Klasyczny licznik czasu pracy (start/stop).
    *   Powiadomienia co godzinę o czasie spędzonym nad zadaniem.
    *   Zapis wyniku do `timeSpend` w zadaniu oraz do `productivity.json`.

### 3.3. Notatki (`feature/notes.js`)
Prosty system przechowywania snippetów kodu lub myśli.
*   **Struktura:** Tytuł + Treść.
*   **Funkcje:** Dodawanie, Wyświetlanie listy, Wyszukiwanie po frazie.

### 3.4. Analityka i Produktywność (`feature/summary.js`, `feature/productivity.js`, `feature/charts.js`)
Moduł odpowiedzialny za raportowanie i wizualizację postępów.

*   **Podsumowanie Dnia:**
    *   Powitanie użytkownika i informacja o aktywnym profilu.
    *   Obliczenie całkowitego czasu pracy w dniu dzisiejszym.
    *   Ostrzeżenie przy pracy powyżej 8h.
    *   **Kalkulator Zarobków:** Jeśli w profilu zdefiniowano stawkę godzinową i walutę, system oblicza dzienny zarobek.
*   **Wykresy (ASCII):**
    *   Wykres słupkowy czasu poświęconego na poszczególne zadania.
    *   Wykres trendu produktywności (godziny pracy w poszczególnych dniach miesiąca).

### 3.5. Planer (`feature/user.js`)
*   Możliwość wybrania konkretnych ID zadań jako "Plan na dziś".
*   Wyświetlanie osobnej listy zadań zaplanowanych na dany dzień.

### 3.6. System i Profile (`feature/user.js`, `index.js`)
*   **Wielu Użytkowników:** Możliwość tworzenia i przełączania się między profilami (np. "Praca", "Prywatne", "Freelance").
*   **Backup i Synchronizacja:**
    *   **Lokalny Backup:** Kopiowanie plików JSON do folderu `backup/`.
    *   **Chmura (WebDAV):** Integracja z Nextcloud/WebDAV. Synchronizacja (Upload/Download) plików profili.
    *   Hasła nie są już przechowywane w repozytorium (wymagane podanie lub konfiguracja lokalna).

## 4. Interfejs Użytkownika (UX)
*   **Interaktywne Menu (`qoa`):** Nawigacja strzałkami, wybór opcji.
*   **Logi (`signale`):** Kolorowe, czytelne komunikaty z ikonami (sukces, błąd, info).
*   **Argumenty CLI (`yargs`):**
    *   `th` / `th -s` : Menu główne.
    *   `th -t` : Szybki podgląd zadań.
    *   `th -p` : Start Pomodoro.
    *   `th -d` : Podsumowanie (Dashboard).

## 5. Obszary do Rozwoju (Roadmapa)
*   [ ] Pełne przejście na bazę danych (np. SQLite/LowDB) zamiast surowych plików JSON (poprawa wydajności i bezpieczeństwa danych).
*   [ ] Ulepszenie synchronizacji (rozwiązywanie konfliktów edycji).
*   [ ] Rozbudowa modułu raportów (eksport do PDF/CSV).
*   [ ] Integracja z zewnętrznymi systemami (Jira, GitHub Issues).
*   [ ] Refaktoryzacja CLI Args (lepsza obsługa flag dla wszystkich funkcji).
