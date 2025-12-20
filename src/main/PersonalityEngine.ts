import { AnalysisResult } from './ProductivityAnalysis';

export type AiMood = 'PANIC' | 'CHILL' | 'GRIND' | 'CELEBRATION' | 'STABLE' | 'SUPPORTIVE';

interface PersonalityContext {
    mood: AiMood;
    userName: string;
    sprintRisk: any;
    habitScore: number;
    tasksRemaining: number;
    lastMessage?: string;
}

export class PersonalityEngine {
    private lastPhrases: string[] = [];

    // Baza fraz po polsku
    private dictionary: Record<AiMood, { prefixes: string[], tips: string[], suffixes: string[] }> = {
        PANIC: {
            prefixes: [
                "Słuchaj, mamy sytuację awaryjną.",
                "Nie chcę Cię stresować, ale liczby nie kłamią.",
                "Ups, chyba trochę przeceniliśmy nasze możliwości.",
                "Marcin, spójrz na to trzeźwym okiem."
            ],
            tips: [
                "Przy obecnym tempie nie zamkniemy tego sprintu. Brakuje nam co najmniej {diff}h.",
                "Zostało {tasks} zadań, a czas ucieka szybciej niż myślisz.",
                "Neural Core przewiduje, że bez rezygnacji z czegoś, polegniemy na finiszu."
            ],
            suffixes: [
                "Może wyrzućmy coś do backlogu?",
                "Skup się tylko na priorytecie High. Reszta może poczekać.",
                "Kawa? Bo czeka nas ciężki wieczór."
            ]
        },
        CHILL: {
            prefixes: [
                "Wygląda na to, że panujemy nad sytuacją.",
                "Status: Nominalny. Nic nas nie goni.",
                "Dobry rytm pracy, tak trzymaj.",
                "Systemy działają w optymalnych parametrach."
            ],
            tips: [
                "Wszystkie zadania są pod kontrolą.",
                "Mamy spory zapas czasu do końca dnia.",
                "Twoje dzisiejsze skupienie jest na świetnym poziomie."
            ],
            suffixes: [
                "Ciesz się flow!",
                "Może to dobry moment na naukę czegoś nowego?",
                "Zasłużyłeś na chwilę przerwy po tym zadaniu."
            ]
        },
        GRIND: {
            prefixes: [
                "Widzę, że włączyłeś tryb bestii!",
                "Masz niesamowite tempo dzisiaj.",
                "Wyciskasz z tych obwodów wszystko, co się da.",
                "Imponująca produktywność."
            ],
            tips: [
                "Realizujemy zadania szybciej niż zwykle.",
                "Nawyki odhaczone, tempo stabilne.",
                "Jeśli utrzymasz to skupienie, skończymy sprint przed czasem."
            ],
            suffixes: [
                "Nie zatrzymuj się teraz!",
                "Pamiętaj tylko o nawodnieniu.",
                "To będzie rekordowy dzień."
            ]
        },
        CELEBRATION: {
            prefixes: [
                "Boom! Tak się to robi!",
                "Fantastyczna robota.",
                "Systemy świętują sukces.",
                "Brawo!"
            ],
            tips: [
                "Właśnie zmiażdżyłeś to zadanie.",
                "Kolejny krok do mistrzostwa zrobiony.",
                "Twoja seria nawyków rośnie w siłę."
            ],
            suffixes: [
                "Dopisuję Ci zasłużone XP.",
                "Chwila oddechu i lecimy dalej?",
                "To był wzorowy pokaz skupienia."
            ]
        },
        STABLE: {
            prefixes: [
                "Działamy zgodnie z planem.",
                "Kolejny produktywny dzień w toku.",
                "System gotowy do wsparcia."
            ],
            tips: [
                "Idziemy stałym tempem przez listę zadań.",
                "Wszystkie parametry w normie.",
                "Pamiętaj o swoich nawykach, to buduje bazę."
            ],
            suffixes: [
                "Daj znać, jeśli potrzebujesz analizy jakiegoś tagu.",
                "Trzymaj ten kurs.",
                "Kontynuujmy realizację celów."
            ]
        },
        SUPPORTIVE: {
            prefixes: [
                "Widzę, że dzisiaj jest trochę trudniej.",
                "Hejo, spokojnie – każdy ma gorsze dni.",
                "Pamiętaj, że produktywność to maraton, nie sprint.",
                "System wykrył spadek energii."
            ],
            tips: [
                "Może zacznijmy od czegoś bardzo małego (5 min)?",
                "Twój sen nie był idealny, nie wymagaj od siebie cudów.",
                "Nawet jeden odhaczony nawyk to dzisiaj wygrana."
            ],
            suffixes: [
                "Jestem tu, żeby pomóc.",
                "Może spacer? To zresetuje neurony.",
                "Zróbmy to powoli, krok po kroku."
            ]
        }
    };

    private getRandom(arr: string[]): string {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    generateMessage(ctx: PersonalityContext): string {
        const dict = this.dictionary[ctx.mood];
        
        let prefix = this.getRandom(dict.prefixes);
        let tip = this.getRandom(dict.tips);
        let suffix = this.getRandom(dict.suffixes);

        // Dynamiczne wstrzykiwanie danych
        const diff = ctx.sprintRisk?.remainingOverCapacity || "2";
        tip = tip.replace("{diff}", String(diff))
                 .replace("{tasks}", String(ctx.tasksRemaining));

        const message = `Thingy: ${prefix} ${tip} ${suffix}`;
        
        // Unikanie powtórzeń (prosty filtr)
        if (this.lastPhrases.includes(message)) {
            return this.generateMessage(ctx); 
        }

        this.lastPhrases.push(message);
        if (this.lastPhrases.length > 5) this.lastPhrases.shift();

        return message;
    }
}

export const personalityEngine = new PersonalityEngine();
