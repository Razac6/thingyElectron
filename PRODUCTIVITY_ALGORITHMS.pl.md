# Algorytmy Produktywności w Thingy

Ten dokument opisuje zaawansowane algorytmy analityczne zaimplementowane w aplikacji Thingy, mające na celu poprawę planowania, estymacji i samoświadomości użytkownika.

## 1. Analityka Tagów (EMA i Odchylenie Standardowe)

System śledzi wydajność użytkownika w kontekście poszczególnych tagów (np. `#backend`, `#design`, `#nauka`).

### Jak to działa?
*   **Aktualizacja w czasie rzeczywistym:** Za każdym razem, gdy zadanie zostaje oznaczone jako **UKOŃCZONE (COMPLETED)**, system analizuje czas spędzony na tym zadaniu (`spendTime`).
*   **EMA (Wykładnicza Średnia Krocząca):** Obliczana jest średnia ważona czasu pracy dla danego tagu, gdzie nowsze zadania mają większą wagę. Dzięki temu średnia szybciej adaptuje się do zmian w Twoim tempie pracy.
*   **Odchylenie Standardowe (Std Dev):** Równocześnie obliczana jest wariancja i odchylenie standardowe. Mierzy ono "rozrzut" czasów realizacji.
    *   **Niskie odchylenie:** Zadania z tym tagiem zajmują zazwyczaj tyle samo czasu (są przewidywalne).
    *   **Wysokie odchylenie:** Czas realizacji zadań z tym tagiem jest bardzo zmienny (trudne do estymowania).

### Gdzie to widać?
*   Wyniki te są prezentowane w widżecie **Smart Insights**.
*   Sugestie w wyszukiwarce (`Ctrl+K`) mogą wyświetlać średni czas dla wpisywanego tagu.

---

## 2. Analiza Optymizmu (DDA - Dynamic Data Analysis)

Algorytm ten pomaga w realistycznym planowaniu Sprintów, chroniąc przed nadmiernym optymizmem (planowaniem większej liczby zadań, niż jesteś w stanie zrealizować).

### Jak to działa?
1.  **Analiza Historyczna:** System pobiera dane z ostatnich **3 ukończonych sprintów**.
2.  **Obliczenie Pojemności (Capacity):** Wyliczana jest średnia suma `estymat` (estimate) zadań ukończonych w tych sprintach. To jest Twoja "rzeczywista prędkość" (velocity).
3.  **Porównanie:** Podczas planowania nowego sprintu, system sumuje estymaty dodanych do niego zadań.
4.  **Ostrzeżenie:** Jeśli suma estymat w nowym sprincie znacząco przekracza Twoją historyczną średnią, system oflaguje to jako "Wysokie Ryzyko Optymizmu".

### Gdzie to widać?
*   Na stronie **Sprints**, w nagłówku aktywnego lub planowanego sprintu, jeśli wykryto ryzyko.

---

## 3. Spójność Tagów (Tag Consistency)

Jest to pochodna Analityki Tagów, która klasyfikuje Twoje obszary pracy na podstawie ich przewidywalności.

### Jak to działa?
Algorytm analizuje zgromadzone dane `tag_analytics` i dzieli tagi na dwie grupy:
*   **Spójne (Consistent):** Tagi, dla których odchylenie standardowe jest niskie w stosunku do średniej. Oznacza to, że jesteś bardzo przewidywalny w tych zadaniach.
*   **Zmienne (Volatile):** Tagi z wysokim odchyleniem standardowym. Oznacza to, że zadania tego typu raz zajmują 15 minut, a innym razem 4 godziny. Sugeruje to potrzebę rozbijania takich zadań na mniejsze lub lepszego ich definiowania.

### Gdzie to widać?
*   W sekcji "Tag Consistency" w widżecie **Smart Insights**.

---

## 4. Podstawowe Metryki Produktywności

System agreguje również surowe dane o czasie pracy, aby pokazać Twój rytm dnia i tygodnia.

### Jak to działa?
*   **Dzienny Czas Pracy:** Suma czasu trwania wszystkich sesji pracy (od startu do stopu stopera) dla danego dnia.
*   **Produktywność Godzinowa:** Agregacja czasu pracy w podziale na godziny doby (00:00 - 23:00), pokazująca, w jakich porach dnia pracujesz najintensywniej.

### Gdzie to widać?
*   Wykresy słupkowe i liniowe na **Dashboardzie** oraz w widżecie statystyk.
