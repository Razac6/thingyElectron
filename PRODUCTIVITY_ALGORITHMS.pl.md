# Algorytmy Produktywności Thingy (Neural Core) 🧠

Dokumentacja logiki stojącej za analizą produktywności, inspirowana pracami Cala Newporta ("Deep Work") i badaniami nad rytmami ultradialnymi.

## 1. Deep Work (Praca Głęboka) - Model Newporta

### Definicja
Sesja pracy jest uznawana za **Głęboką (Deep)**, jeśli spełnia łącznie dwa warunki:
1.  **Czas trwania:** Minimum **20 minut** (czas potrzebny na wejście w *flow*) i maksimum **120 minut** (granica zmęczenia poznawczego).
2.  **Kontekst Skupienia (Focus Context):** Wynik > 0.75. Oznacza to, że użytkownik spędził mniej niż 25% czasu na stronach/aplikacjach klasyfikowanych jako "Rozrywka" (Social Media, Gry, Newsy).

### Cel Dzienny (The 4-Hour Limit)
Zgodnie z Calem Newportem, ludzki mózg jest zdolny do maksymalnie **4 godzin** intensywnej pracy głębokiej dziennie.
- **100% Deep Work Score** = 4 godziny (240 minut) sesji głębokich.
- Wynik powyżej 4h jest możliwy, ale obarczony ryzykiem wypalenia ("Junk Deep Work").

---

## 2. Max Focus & Fatigue (Zmęczenie)

### Rytmy Ultradialne
Ludzki mózg pracuje w cyklach 90-minutowych. Po tym czasie następuje spadek koncentracji.
- **Algorytm:** Analizuje historię Twoich sesji (średnia długość + odchylenie standardowe).
- **Zalecenie:** Sugeruje długość kolejnej sesji.
    - Domyślnie: **60 minut** (dla nowych użytkowników).
    - Minimum: **30 minut**.
    - Maksimum: **120 minut**.

---

## 3. Focus Context (Kontekst Skupienia)

Analiza "tła" pracy w czasie rzeczywistym.
- **Źródła:** `web_stats` (odwiedzone domeny) i `app_activity` (aktywne okna).
- **Kategorie Rozpraszające:** Social, Entertainment, Shopping, Game.
- **Obliczanie:** `1.0 - (Czas Rozproszeń / Czas Całkowity)`.
    - *Przykład:* 60 min pracy, w tym 15 min na Facebooku = Score 0.75.

---

## 4. Wskaźniki Wizualne (Widgety)

- **Deep Work Today:** Ilość czasu głębokiego w dniu dzisiejszym.
- **Max Focus:** Najdłuższa nieprzerwana sesja dzisiaj vs Zalecany Limit.