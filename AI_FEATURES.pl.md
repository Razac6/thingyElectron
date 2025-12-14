# Inteligentne Funkcje Thingy (AI Features)

Twoja aplikacja to nie tylko lista zadań. To inteligentny system, który uczy się Twojego stylu pracy, aby pomóc Ci być bardziej produktywnym.

## 1. NeuralCore (TensorFlow AI)

W sercu aplikacji działa lokalny model sieci neuronowej (TensorFlow.js).

*   **Jak to działa:** Model analizuje historię Twoich zadań (kiedy je robisz, jaki mają priorytet, ile czasu zajmują, jak spałeś).
*   **Trening:** Przy każdym uruchomieniu aplikacji, model "dotrenowuje się" na Twoich nowych danych. Postęp możesz śledzić w **System Logs** (`[NEURAL]`).
*   **Predykcja:** Model potrafi przewidzieć, ile czasu zajmie Ci zadanie w danych warunkach.
*   **AI Advisor:** Model generuje porady ("Neural Alert" / "Neural Insight"), które pojawiają się w widgecie Smart Insights (ikona robota).

## 2. Bio-Feedback (Tryby Dzienne)

Aplikacja rozumie, że nie jesteś robotem i masz gorsze dni.

*   **Tryby Pracy (w Smart Insights):**
    *   🔥 **Boost:** Dzień wysokiej energii. System wyłącza blokady zmęczenia i pozwala planować więcej.
    *   🟢 **Normal:** Standardowe ustawienia.
    *   🌱 **Recovery:** Dzień regeneracji. System sugeruje częstsze przerwy i zmniejsza oczekiwania co do sprintu.
*   **Sleep Tracking:** Opcjonalnie (w Ustawieniach) możesz wpisywać swój **Sleep Score** (0-100). Model AI używa tego, aby lepiej przewidywać Twoją wydajność.

## 3. Smart Checklist & Complexity Analysis

*   **Smart Checklist:** Każde zadanie może mieć podpunkty. Odhaczanie ich daje precyzyjniejszy obraz postępu niż sama estymata czasowa.
*   **Complexity Warning:** Jeśli stworzysz zadanie na > 8h bez checklisty, system ostrzeże Cię ("High Complexity Detected"), sugerując rozbicie go na mniejsze części.

## 4. Analityka i Gamifikacja

*   **Tag Analytics (EMA):** System uczy się, ile średnio zajmują Ci zadania danego typu (np. `#backend`, `#design`).
*   **Neural Confidence:** Pasek postępu w logach (0-100%) pokazuje, jak pewny swoich przewidywań jest system.
*   **Fatigue Management:** Jeśli system wykryje, że pracujesz za długo bez przerwy, wyświetli powiadomienie. Jeśli posłuchasz i klikniesz "Stop Timer & Rest", dostaniesz nagrodę **+15 XP**.

## Jak zacząć?

1.  Używaj aplikacji regularnie (kończ zadania).
2.  Eksperymentuj z trybami (Boost/Recovery).
3.  Obserwuj **System Logs**, aby widzieć "myśli" maszyny.
