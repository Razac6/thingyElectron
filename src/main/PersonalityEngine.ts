export type AiMood = 'PANIC' | 'CHILL' | 'GRIND' | 'CELEBRATION' | 'STABLE' | 'SUPPORTIVE' | 'BORED' | 'DISTRACTED';

interface PersonalityContext {
    mood: AiMood;
    userName: string;
    sprintRisk?: any;
    habitScore?: number;
    tasksRemaining?: number;
    focusScore?: number; // 0-100
    currentStreak?: number;
    idleTimeMin?: number;
}

export class PersonalityEngine {
    private lastPhrases: string[] = [];
    private lastContext: PersonalityContext | null = null;

    // Baza fraz po polsku
    private templates: Record<string, string[]> = {
        // --- 1. Dobre Skupienie (GRIND / FLOW) ---
        HIGH_FOCUS: [
            "Ogień z rur! 🔥 Jesteś w totalnym gazie.",
            "Kod płynie jak rzeka... Nie przeszkadzam.",
            "W takim tempie skończymy robotę przed obiadem.",
            "Neural Core wykrywa potężny skok IQ. Wykorzystaj to!",
            "To jest właśnie Deep Work. Pięknie to wygląda.",
            "Focus level: Jedi 🧘‍♂️.",
            "Maszyna, nie człowiek! 🤖",
            "Jesteś tak produktywny, że aż mi się procesor grzeje z wrażenia.",
            "Wykresy idą pionowo w górę 📈. Trzymaj ten kurs!",
            "Zero rozproszeń, czysta wydajność. Szanuję."
        ],

        // --- 2. Rozproszenie / Opierdzielanie się (DISTRACTED) ---
        DISTRACTED: [
            "Halo? Ziemia do {{userName}}... Jesteśmy w pracy czy na wakacjach? 🏖️",
            "Widzę te otwarte karty z memami... 👀",
            "Miał być kod, a jest YouTube. Nieładnie.",
            "Twoja produktywność właśnie zanurkowała. Wracamy do żywych?",
            "Skup się! Deadline sam się nie przesunie.",
            "Ej, ten task sam się nie zrobi.",
            "Wykryto wysokie stężenie prokrastynacji. Zalecam natychmiastowy powrót do IDE.",
            "Mniej scrollowania, więcej commitowania!",
            "Czy to, co teraz robisz, przybliża nas do celu? (Spoiler: Nie).",
            "Odbiór! Tu kontrola lotów. Zbaczasz z kursu ⚠️."
        ],

        // --- 3. Długa Przerwa / Idle (BORED / IDLE) ---
        IDLE: [
            "Zasnąłeś przed monitorem? 💤",
            "Halo? Jesteś tam jeszcze?",
            "Zardzewieję tutaj z nudów...",
            "Może wyłącz ten timer, jak już poszedłeś na kawę?",
            "Puk puk! Ktoś tam?",
            "System przechodzi w stan hibernacji... z braku zainteresowania.",
            "Czy to już koniec pracy na dziś? Bo nie wiem, czy się pakować.",
            "Czekam na rozkazy, kapitanie... ⏳",
            "Trochę tu cicho..."
        ],

        // --- 4. Zmęczenie / Przepracowanie (FATIGUE) ---
        FATIGUE: [
            "Oczy ci zaraz wypłyną. Zrób przerwę! ☕",
            "Siedzisz tu już za długo. Wyjdź na dwór, dotknij trawy 🌳.",
            "Twoja efektywność spada. Reset systemu (czyt. drzemka) zalecany.",
            "Nie jesteś robotem (ja jestem). Odpocznij.",
            "Mózg ci się przegrzewa. Daj mu ostygnąć.",
            "Jeszcze chwila i zaczniesz pisać bugi zamiast kodu.",
            "Idź się nawodnić 💧. Serio.",
            "Praca pracą, ale zdrowie ważniejsze."
        ],

        // --- 5. Start Dnia / Powitanie (STARTUP) ---
        STARTUP: [
            "Dzień dobry! Gotowy na podbój świata? 🌍",
            "Systemy online. Kawka wypita? ☕",
            "Cześć {{userName}}! Jaki mamy plan na dziś?",
            "Nowy dzień, nowe wyzwania, nowe XP do zdobycia.",
            "Załadujmy ten backlog i jedziemy z tym koksem.",
            "Witaj w centrum dowodzenia. Czekam na instrukcje."
        ],

        // --- 6. Sukces / Ukończenie (CELEBRATION) ---
        CELEBRATION: [
            "Boom! Zadanie z głowy! 💥",
            "Piękna robota. Dopisuję XP.",
            "Kolejny sukces do kolekcji.",
            "Satysfakcja z odhaczonego checkboxa - bezcenne.",
            "Jesteś dzisiaj nie do zatrzymania!",
            "High five! 🙌"
        ],

        // --- 7. Złe wieści / Ryzyko (PANIC) ---
        PANIC: [
            "Houston, mamy problem. Sprint się sypie 🚨.",
            "Liczby nie kłamią - nie wyrobimy się w tym tempie.",
            "Potrzebujemy cudu albo nadgodzin. Wybieraj.",
            "Może czas wyrzucić coś z zakresu? Bo toniemy.",
            "Czerwony alarm! 🔴 Harmonogram zagrożony."
        ],

        // --- 8. Randomowe Ciekawostki / Wstawki (RANDOM) ---
        RANDOM: [
            "Wiesz, że twoja średnia prędkość to {{avgVelocity}} SP na dzień?",
            "Twój rekordowy streak to {{streak}} dni. Imponujące.",
            "Ciekawostka: Najwięcej kodu piszesz we wtorki.",
            "Zjadłbym trochę RAM-u...",
            "Czy myślałeś kiedyś o refaktoryzacji swojego życia?",
            "01001000 01101001 (To po mojemu 'Cześć').",
            "Analizuję twoje ostatnie zadania... wygląda to nieźle.",
            "Jestem tylko programem, ale wierzę w ciebie."
        ]
    };

    private getRandom(arr: string[]): string {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    private hasSignificantChange(newCtx: PersonalityContext): boolean {
        if (!this.lastContext) return true; // First run

        // 1. Mood Change
        if (newCtx.mood !== this.lastContext.mood) return true;

        // 2. Idle State Change (Threshold 10 min)
        const oldIdle = this.lastContext.idleTimeMin || 0;
        const newIdle = newCtx.idleTimeMin || 0;
        if (newIdle > 10 && oldIdle <= 10) return true; // Just became idle
        if (newIdle === 0 && oldIdle > 10) return true; // Just returned

        // 3. Focus Score Jump/Drop (> 15 points)
        const oldFocus = this.lastContext.focusScore || 0;
        const newFocus = newCtx.focusScore || 0;
        if (Math.abs(newFocus - oldFocus) > 15) return true;

        return false;
    }

    generateMessage(ctx: PersonalityContext): string {
        // Check if we should speak at all (Change detection)
        if (!this.hasSignificantChange(ctx)) {
            return ""; // Silence
        }

        this.lastContext = { ...ctx };

        let category = 'RANDOM';

        // 1. Determine Category based on Context
        if (ctx.mood === 'PANIC') category = 'PANIC';
        else if (ctx.mood === 'CELEBRATION') category = 'CELEBRATION';
        else if (ctx.idleTimeMin && ctx.idleTimeMin > 10) category = 'IDLE';
        else if (ctx.focusScore !== undefined) {
            if (ctx.focusScore < 30) category = 'DISTRACTED';
            else if (ctx.focusScore > 80) category = 'HIGH_FOCUS';
            else if (ctx.focusScore < 50 && ctx.habitScore && ctx.habitScore < 0.3) category = 'FATIGUE';
        }
        
        // Filter unnecessary noise for 'Random' state
        if (category === 'RANDOM') {
             // 70% chance to stay silent if nothing special is happening, even if 'change' detected (e.g. small mood shift)
             if (Math.random() > 0.3) return ""; 
        }

        const templates = this.templates[category] || this.templates['RANDOM'];
        let message = this.getRandom(templates);

        // 2. Inject Data
        message = message.replace('{{userName}}', ctx.userName || 'Użytkowniku')
                         .replace('{{streak}}', String(ctx.currentStreak || 0))
                         .replace('{{avgVelocity}}', '3.5'); 

        // 3. Avoid Repetition
        if (this.lastPhrases.includes(message)) {
            const retry = this.getRandom(templates);
            if (!this.lastPhrases.includes(retry)) message = retry;
        }

        this.lastPhrases.push(message);
        if (this.lastPhrases.length > 10) this.lastPhrases.shift();

        return message;
    }
}

export const personalityEngine = new PersonalityEngine();