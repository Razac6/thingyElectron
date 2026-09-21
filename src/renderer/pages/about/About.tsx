import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Grid,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import AssessmentIcon from '@mui/icons-material/Assessment';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PsychologyIcon from '@mui/icons-material/Psychology';

function About() {
  return (
    <Box sx={{ p: 3, maxWidth: '1200px', margin: '0 auto' }}>
      <Paper sx={{ p: 4, mb: 3 }}>
        <Typography
          variant="h3"
          gutterBottom
          sx={{ fontWeight: 300, color: '#023047' }}
        >
          O Aplikacji Thingy
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" paragraph>
          Inteligentny system zarządzania zadaniami z wbudowaną sztuczną
          inteligencją
        </Typography>
        <Divider sx={{ my: 2 }} />
        <Typography variant="body1" paragraph>
          Thingy to zaawansowana aplikacja produktywności wykorzystująca
          algorytmy uczenia maszynowego do optymalizacji Twojej pracy. System
          analizuje Twoje wzorce behawioralne i dostosowuje się do Twojego stylu
          pracy, oferując personalizowane sugestie i predykcje.
        </Typography>
      </Paper>

      {/* Core Features */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 500, mb: 2 }}>
          Główne Funkcje
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={4}>
            <Card variant="outlined">
              <CardContent>
                <CheckCircleIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
                <Typography variant="h6" gutterBottom>
                  Zarządzanie Zadaniami
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Kompleksowy system tasków z timerami, Pomodoro, sprintami, i
                  auto-schedulingiem AI
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Card variant="outlined">
              <CardContent>
                <ShowChartIcon color="secondary" sx={{ fontSize: 40, mb: 1 }} />
                <Typography variant="h6" gutterBottom>
                  Analityka Produktywności
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Szczegółowe wykresy, contribution graphs, hourly heatmaps,
                  deep work tracking
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Card variant="outlined">
              <CardContent>
                <SmartToyIcon color="info" sx={{ fontSize: 40, mb: 1 }} />
                <Typography variant="h6" gutterBottom>
                  AI Companion
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Wirtualny asystent z 8 nastrojami dostosowującymi styl
                  komunikacji do kontekstu
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>

      {/* AI Algorithms */}
      <Typography
        variant="h4"
        gutterBottom
        sx={{ mt: 4, mb: 2, fontWeight: 400 }}
      >
        Algorytmy Sztucznej Inteligencji
      </Typography>

      {/* NeuralCore */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <PsychologyIcon color="primary" />
            <Box>
              <Typography variant="h6">
                1. NeuralCore - Predykcja Czasu Trwania Tasków
              </Typography>
              <Chip
                label="TensorFlow.js"
                size="small"
                color="primary"
                sx={{ mt: 0.5 }}
              />
              <Chip
                label="Deep Learning"
                size="small"
                sx={{ mt: 0.5, ml: 0.5 }}
              />
            </Box>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            Opis:
          </Typography>
          <Typography paragraph>
            Sieć neuronowa przewidująca rzeczywisty czas wykonania zadań na
            podstawie historycznych danych. Model uczy się na Twoich ukończonych
            taskach i z czasem staje się coraz dokładniejszy.
          </Typography>

          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            Architektura:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText
                primary="Typ: Sieć Neuronowa Sequential (TensorFlow.js)"
                secondary="3 warstwy dense: 8 → 4 → 1, z dropout 0.2 i regularyzacją L2 - celowo mała sieć, bo osobisty tracker realnie generuje dziesiątki/setki (nie tysiące) ukończonych tasków do treningu"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Input: 10 cech"
                secondary="godzina i dzień tygodnia (cyklicznie kodowane sin/cos), priorytet, wynik snu, obciążenie spotkaniami, wynik realizacji nawyków, story points, kontekst skupienia (focus context)"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Output: Predykcja czasu w minutach"
                secondary="Warstwa wyjściowa: 1 neuron (aktywacja liniowa)"
              />
            </ListItem>
          </List>

          <Typography
            variant="subtitle2"
            fontWeight="bold"
            gutterBottom
            sx={{ mt: 2 }}
          >
            Proces Uczenia:
          </Typography>
          <Typography paragraph>
            • Trening: Automatyczny (daily scheduler + manual trigger), min. 5
            ukończonych tasków
            <br />
            • Loss Function: Mean Squared Error (MSE)
            <br />
            • Optimizer: Adam (domyślny learning rate)
            <br />
            • Max epochs: 30, Batch size: 32, Validation split: 20%
            <br />
            • Early Stopping: przerywa trening, gdy błąd walidacji przestaje
            spadać (patience: 5 epok) - chroni przed przeuczeniem na małym
            zbiorze danych
            <br />
            • Cooldown: 10 minut między treningami
            <br />• Persistence: wagi (razem z kształtem tensora) zapisywane
            lokalnie w userData; w razie niezgodności kształtu (np. po zmianie
            liczby cech) model bezpiecznie się resetuje i trenuje od nowa
          </Typography>

          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            Dodatkowo:
          </Typography>
          <Typography paragraph>
            Predykcja sieci jest łączona (blend) z prostszym punktem odniesienia
            - historyczną średnią EMA dla tagów taska, a gdy jej brak, z własną
            estymatą użytkownika podaną przy tworzeniu taska. Waga sieci w tym
            mieszaniu rośnie płynnie wraz z dojrzałością modelu (AI maturity:
            liczba treningów + wolumen danych) - im mniej dana sieć jeszcze
            "widziała", tym bardziej system polega na prostszym punkcie
            odniesienia zamiast ślepo ufać predykcji.
          </Typography>

          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            Zastosowanie:
          </Typography>
          <Typography>
            Automatyczne sugerowanie realnych estymacji przy tworzeniu zadań,
            pomoc w planowaniu sprintów (Sprint Risk Analysis), scoring tasków w
            auto-schedulerze.
          </Typography>
        </AccordionDetails>
      </Accordion>

      {/* ProductivityAnalyst */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <ShowChartIcon color="secondary" />
            <Box>
              <Typography variant="h6">
                2. ProductivityAnalyst - Analiza Produktywności
              </Typography>
              <Chip
                label="Statistical ML"
                size="small"
                color="secondary"
                sx={{ mt: 0.5 }}
              />
            </Box>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            Opis:
          </Typography>
          <Typography paragraph>
            Zestaw 10+ algorytmów statystycznych analizujących Twoje wzorce
            pracy i generujących personalizowane insighty.
          </Typography>

          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            Algorytmy:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemIcon>1.</ListItemIcon>
              <ListItemText
                primary="Peak Hours Detection (Weighted Frequency Distribution)"
                secondary="Agreguje czas pracy per godzina; sesje z ostatnich 7 dni liczone są podwójnie (waga 2.0x) względem starszych"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>2.</ListItemIcon>
              <ListItemText
                primary="Fatigue Profiling"
                secondary="Rekomendowany limit sesji = średnia + 1.5 odchylenia standardowego (capped 30-120min)"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>3.</ListItemIcon>
              <ListItemText
                primary="Productivity Trend Analysis"
                secondary="Regresja liniowa na ostatnich 14 dniach z wykrywaniem trendu (wzrost/spadek/stabilny)"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>4.</ListItemIcon>
              <ListItemText
                primary="Focus Quality / Deep Work Score"
                secondary="Deep Work = sesja 20-120min z kontekstem skupienia (focus context) powyżej 75%"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>5.</ListItemIcon>
              <ListItemText
                primary="Tag Consistency Analysis"
                secondary="Coefficient of Variation (CV): poniżej 0.25 = konsystentny tag, powyżej 0.6 = zmienny (volatile)"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>6.</ListItemIcon>
              <ListItemText
                primary="AI Scheduler Suggestion"
                secondary="Sugeruje porę dnia na trudny/łatwy task na podstawie Peak Hours - widoczne jako chip na widoku taska"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>7.</ListItemIcon>
              <ListItemText
                primary="Tag Difficulty Profiling"
                secondary="Mnożnik rzeczywisty/estymowany czas per tag (liczony tylko dla tagów z ponad 1h łącznej estymaty)"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>8.</ListItemIcon>
              <ListItemText
                primary="AI Task Scoring"
                secondary="Wariant WSJF (Weighted Shortest Job First) do priorytetyzacji zadań w auto-schedulerze"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>9.</ListItemIcon>
              <ListItemText
                primary="Habit-Productivity Correlation"
                secondary="Porównuje focus score w dni z wysoką (≥80%) vs niską (≤40%) realizacją nawyków - widoczne na dashboardzie, gdy różnica przekracza 10%"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>10.</ListItemIcon>
              <ListItemText
                primary="Sprint Risk Analysis"
                secondary="Porównuje pozostały czas pracy z dostępną pojemnością (godziny pracy); fallback do historycznej prędkości, gdy harmonogram jest nierealny"
              />
            </ListItem>
          </List>

          <Typography
            variant="subtitle2"
            fontWeight="bold"
            gutterBottom
            sx={{ mt: 2 }}
          >
            Output:
          </Typography>
          <Typography>
            Dashboard insights, kontekstowe daily tips (generateDailyTip),
            rekomendacje peak hours, ostrzeżenia o zmęczeniu, wykresy trendu.
          </Typography>
        </AccordionDetails>
      </Accordion>

      {/* PersonalityEngine */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <SmartToyIcon color="info" />
            <Box>
              <Typography variant="h6">
                3. PersonalityEngine - AI Companion
              </Typography>
              <Chip
                label="NLP Templates"
                size="small"
                color="info"
                sx={{ mt: 0.5 }}
              />
            </Box>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            Opis:
          </Typography>
          <Typography paragraph>
            System generowania wiadomości z 8 kategoriami tonu, dostosowujący
            komunikat do kontekstu użytkownika (nastrój sprintu, focus score,
            idle time, pierwsza wiadomość sesji).
          </Typography>

          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            Kategorie wiadomości (8):
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText
                primary="PANIC - Alarm sprintu"
                secondary="Trigger: sprint w krytycznym ryzyku (najwyższy priorytet)"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="CELEBRATION - Świętowanie"
                secondary="Trigger: nastrój ustawiony na sukces/ukończenie"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="IDLE - Długa bezczynność"
                secondary="Trigger: idleTime > 10 minut"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="DISTRACTED - Rozproszenie"
                secondary="Trigger: focus score < 30%"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="HIGH_FOCUS - Deep Work"
                secondary="Trigger: focus score > 80%"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="FATIGUE - Zmęczenie"
                secondary="Trigger: focus score < 50% oraz wynik nawyków < 30%"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="STARTUP - Powitanie"
                secondary="Trigger: pierwsza wiadomość w tej sesji appki, gdy nic pilniejszego się nie dzieje"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="RANDOM - Ciekawostka/domyślna"
                secondary="Fallback, gdy żaden z powyższych triggerów nie zaszedł (70% szans na ciszę, żeby nie spamować)"
              />
            </ListItem>
          </List>

          <Typography
            variant="subtitle2"
            fontWeight="bold"
            gutterBottom
            sx={{ mt: 2 }}
          >
            Algorytm Wyboru Kategorii:
          </Typography>
          <Typography paragraph>
            1. Change Detection: system mówi tylko przy istotnej zmianie
            kontekstu (zmiana nastroju, przekroczenie progu idle 10min, skok
            focus score o ponad 15 punktów) - inaczej cisza
            <br />
            2. Priorytetowy łańcuch warunków (nie decision tree): PANIC →
            CELEBRATION → IDLE → DISTRACTED/HIGH_FOCUS/FATIGUE (na bazie focus
            score) → STARTUP (pierwsza wiadomość) → RANDOM
            <br />
            3. Template Selection: losowy szablon z listy dla wybranej
            kategorii, z unikaniem powtórzenia ostatnich 10 wiadomości
            <br />
            4. Variable Injection: {'{{userName}}'}, {'{{streak}}'} (realny
            aktualny streak nawyków),
            {'{{avgVelocity}}'} (realna średnia prędkość story points/dzień z
            ostatnich 30 dni)
          </Typography>

          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            Integracja:
          </Typography>
          <Typography>
            Widget na Dashboard (AI Companion) i pasek statusu, zasilane przez
            handler IPC db:get-ai-message, który liczy nastrój na bazie realnej
            analizy ryzyka sprintu (NeuralCore).
          </Typography>
        </AccordionDetails>
      </Accordion>

      {/* ProcrastinationDetector */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <WarningAmberIcon color="warning" />
            <Box>
              <Typography variant="h6">
                4. ProcrastinationDetector - Wykrywanie Prokrastynacji
              </Typography>
              <Chip
                label="TensorFlow.js"
                size="small"
                color="warning"
                sx={{ mt: 0.5 }}
              />
              <Chip
                label="Supervised Learning"
                size="small"
                sx={{ mt: 0.5, ml: 0.5 }}
              />
            </Box>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            Opis:
          </Typography>
          <Typography paragraph>
            Model uczenia maszynowego wykrywający wzorce prokrastynacji na
            poziomie pojedynczych tasków. Predykcja ryzyka prokrastynacji (0-1)
            + personalizowane sugestie działania.
          </Typography>

          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            Architektura:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText
                primary="Typ: Binary Classification Neural Network"
                secondary="3 warstwy dense (16 → 8 → 1) + dropout 0.2"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Input: 8 cech"
                secondary="taskAge, estimatedDifficulty, priorityEncoded, recentSwitchCount (realne przełączenia aplikacji z ostatniej godziny), webDistractionScore (realny czas na rozpraszających stronach), timeOfDay (sin/cos), daysSinceLastSimilar (realny odstęp od ostatniego podobnego taska)"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Output: Procrastination Risk (0-1)"
                secondary="Sigmoid activation → prawdopodobieństwo prokrastynacji"
              />
            </ListItem>
          </List>

          <Typography
            variant="subtitle2"
            fontWeight="bold"
            gutterBottom
            sx={{ mt: 2 }}
          >
            Proces Uczenia (Self-Supervised):
          </Typography>
          <Typography paragraph>
            • Labeling Heuristic: Task = procrastinated (1) jeśli:
            <br />
            &nbsp;&nbsp;- actualTime &gt; 2x estimate LUB
            <br />
            &nbsp;&nbsp;- daysToComplete &gt; 7 dni
            <br />
            • Training Frequency: Raz dziennie (daily scheduler)
            <br />
            • Min. Samples: 10 ukończonych tasków
            <br />
            • Loss: Binary Crossentropy
            <br />
            • Metrics: Accuracy
            <br />• Epochs: 50, Batch: 16, Validation: 20%
          </Typography>

          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            Feature Engineering:
          </Typography>
          <Typography paragraph>
            • Time of Day: Sin/Cos encoding (circular feature)
            <br />
            • Priority: Ordinal encoding High=3, Med=2, Low=1
            <br />
            • Difficulty: estimate × (storyPoints/5)
            <br />• All features normalized to [0,1] range
          </Typography>

          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            Output & Actions:
          </Typography>
          <Typography paragraph>
            1. Risk Badge w List View ("Risk" z ikoną ostrzeżenia) dla tasków z
            risk &gt; 0.7
            <br />
            2. Tooltip z reasons: ["Task leży już 15 dni - to czerwona flaga",
            ...]
            <br />
            3. Actionable Suggestions:
            <br />
            &nbsp;&nbsp;• High risk + high difficulty → "Podziel na subtaski"
            <br />
            &nbsp;&nbsp;• High risk + old task → "Eat the Frog - zrób jako
            pierwszy"
            <br />
            &nbsp;&nbsp;• Medium risk → "Time-boxing: Zaplanuj konkretny slot"
          </Typography>
        </AccordionDetails>
      </Accordion>

      {/* DailyStandupAI */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <AssessmentIcon color="primary" />
            <Box>
              <Typography variant="h6">
                5. DailyStandupAI - Inteligentne Raporty Dzienne
              </Typography>
              <Chip
                label="Analytics + NLP"
                size="small"
                color="primary"
                sx={{ mt: 0.5 }}
              />
            </Box>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            Opis:
          </Typography>
          <Typography paragraph>
            Automatyczny generator daily standup reports analizujący Twoją
            produktywność i generujący insighty oraz rekomendacje w formacie
            zbliżonym do Scrum daily standup.
          </Typography>

          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            Komponenty:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText
                primary="1. Stats Aggregation"
                secondary="Łączny czas pracy, liczba tasków, deep work minutes, productivity level (high/medium/low)"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="2. Task Filtering & Categorization"
                secondary="Completed today, In Progress - z metadata (type, spendTime, estimate)"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="3. Insight Generation (5 typów, max 3 pokazywane)"
                secondary={
                  'Jakość focusu, trafność estymat, tempo ("beast mode"), korelacja ze snem, obciążenie spotkaniami'
                }
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="4. Recommendation Engine (4 sprawdzenia, max 3 pokazywane)"
                secondary="Niski focus → sugestia Pomodoro | Wzorzec długości sesji → sugestia przerw | Za dużo tasków In Progress → sugestia skupienia | Balans praca-życie (&gt;10h ostrzeżenie / &lt;2h planowanie)"
              />
            </ListItem>
          </List>

          <Typography
            variant="subtitle2"
            fontWeight="bold"
            gutterBottom
            sx={{ mt: 2 }}
          >
            Algorytm Productivity Level:
          </Typography>
          <Typography paragraph>
            • High: focus score &gt;75% AND ukończone taski ≥3
            <br />
            • Medium: focus score &gt;50% LUB ukończone taski ≥2
            <br />• Low: wszystko poniżej
          </Typography>

          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            Weekly Standup:
          </Typography>
          <Typography paragraph>
            Dodatkowa funkcja generateWeeklyStandup zbiera te same statystyki z
            ostatnich 7 dni (łączny czas, rozkład typów tasków, deep work) -
            obecnie zaimplementowana, ale jeszcze niepodpięta do żadnego widoku
            w UI.
          </Typography>

          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            UI Integration:
          </Typography>
          <Typography>
            Raport dzienny pokazuje się inline w widgecie AI Companion na
            Dashboardzie (tabelka stats, insights i rekomendacje).
          </Typography>
        </AccordionDetails>
      </Accordion>

      {/* ContextAwareNotifications */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <NotificationsActiveIcon sx={{ color: '#ff6b6b' }} />
            <Box>
              <Typography variant="h6">
                6. ContextAwareNotifications - Inteligentne Powiadomienia
              </Typography>
              <Chip
                label="Context Analysis"
                size="small"
                sx={{ bgcolor: '#ff6b6b', color: 'white', mt: 0.5 }}
              />
            </Box>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            Opis:
          </Typography>
          <Typography paragraph>
            System powiadomień analizujący kontekst użytkownika w czasie
            rzeczywistym i wysyłający powiadomienia tylko wtedy, gdy są naprawdę
            potrzebne.
          </Typography>

          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            Context Factors (6 metryk):
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText
                primary="Focus Score (0-100)"
                secondary="Z ProductivityAnalyst - aktualna jakość koncentracji"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Session Time (minutes)"
                secondary="Czas od rozpoczęcia work session bez przerwy"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Meeting Time (minutes)"
                secondary="Łączny czas spotkań dzisiaj z daily_energy_logs"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Sleep Score (0-100)"
                secondary="Z bio tracking - jakość snu ostatniej nocy"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Habit Score (0-1)"
                secondary="% nawyków ukończonych dzisiaj"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Recent Pattern"
                secondary="Klasyfikacja: focused | distracted | fatigued | normal"
              />
            </ListItem>
          </List>

          <Typography
            variant="subtitle2"
            fontWeight="bold"
            gutterBottom
            sx={{ mt: 2 }}
          >
            Notification Priority System (7 priorytetów):
          </Typography>
          <Typography component="div" paragraph>
            1. <strong>High Priority - Fatigue Detection</strong>
            <br />
            &nbsp;&nbsp;Trigger: sessionTime &gt;90min AND focusScore &lt;50
            <br />
            &nbsp;&nbsp;Message: "Zmęczony mózg wykryty. Twój mózg potrzebuje
            5-10min przerwy."
            <br />
            <br />
            2. <strong>High Priority - Meeting Overload</strong>
            <br />
            &nbsp;&nbsp;Trigger: meetingTime &gt;180min AND focusScore &lt;40
            <br />
            &nbsp;&nbsp;Message: "Meeting Overload wypaliło Twoje CPU. Zostaw
            dziś tylko proste taski."
            <br />
            <br />
            3. <strong>Medium Priority - Sleep Deprivation</strong>
            <br />
            &nbsp;&nbsp;Trigger: sleepScore &lt;50 AND sessionTime &gt;60
            <br />
            &nbsp;&nbsp;Message: "Twoja funkcja kognitywna jest obniżona. Skup
            się na admin tasks."
            <br />
            <br />
            4. <strong>Medium Priority - Distraction Alert</strong>
            <br />
            &nbsp;&nbsp;Trigger: recentPattern=distracted AND sessionTime &gt;20
            <br />
            &nbsp;&nbsp;Message: "Rozproszenie wykryte. Zamknij karty, wyłącz
            komunikatory na 25 min?"
            <br />
            &nbsp;&nbsp;Action Button: "Pomodoro 25min"
            <br />
            <br />
            5. <strong>Low Priority - Hydration Reminder</strong>
            <br />
            &nbsp;&nbsp;Trigger: sessionTime przekracza kolejny próg 60-minutowy
            (raz na każdą godzinę sesji)
            <br />
            &nbsp;&nbsp;Message: "Twój mózg to 73% wody - czas go uzupełnić!"
            <br />
            <br />
            6. <strong>Low Priority - Habit Check</strong>
            <br />
            &nbsp;&nbsp;Trigger: habitScore &lt;0.3 AND hour &gt;14
            <br />
            &nbsp;&nbsp;Message: "Dzisiaj zaliczyłeś tylko X% nawyków. Jeszcze
            jest czas!"
            <br />
            <br />
            7. <strong>Low Priority - Flow State Encouragement</strong>
            <br />
            &nbsp;&nbsp;Trigger: recentPattern=focused AND 45&lt; sessionTime
            &lt;90
            <br />
            &nbsp;&nbsp;Message: "Flow State aktywny! Wyłączam powiadomienia na
            next 30min."
          </Typography>

          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            Anti-Spam Protection:
          </Typography>
          <Typography paragraph>
            • Cooldown: 15 minut między powiadomieniami
            <br />
            • Session Tracking: Start on timer start, End on timer stop
            <br />• Check Frequency: Co 10 minut (w TimerContext useEffect)
          </Typography>

          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            Implementation:
          </Typography>
          <Typography>
            Electron Notification API + IPC handlers (notifications:check,
            start-session, end-session). Pattern detection w
            ContextAwareNotificationEngine.analyzeContext().
          </Typography>
        </AccordionDetails>
      </Accordion>

      {/* Additional Features */}
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 500, mb: 2 }}>
          Dodatkowe Funkcje
        </Typography>
        <List>
          <ListItem>
            <ListItemIcon>
              <CheckCircleIcon color="success" />
            </ListItemIcon>
            <ListItemText
              primary="Task Scheduler (Auto-Scheduling)"
              secondary="Algorytm priorytetyzacji tasków bazujący na deadline, priority, estimate, storyPoints + machine learning predictions"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <CheckCircleIcon color="success" />
            </ListItemIcon>
            <ListItemText
              primary="Gamification System"
              secondary="Achievements, XP, Leveling, Daily Challenges z inteligentnym systemem nagród"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <CheckCircleIcon color="success" />
            </ListItemIcon>
            <ListItemText
              primary="Habit Tracking"
              secondary="Streaks, favorite habits, completion statistics z contribution graph visualization"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <CheckCircleIcon color="success" />
            </ListItemIcon>
            <ListItemText
              primary="Sprint Management"
              secondary="Scrum-style sprints z capacity planning, velocity tracking, burndown charts"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <CheckCircleIcon color="success" />
            </ListItemIcon>
            <ListItemText
              primary="Web Activity Monitoring"
              secondary="Chrome Extension integracja - tracking czasu na stronach + distraction detection"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <CheckCircleIcon color="success" />
            </ListItemIcon>
            <ListItemText
              primary="Meditation & Mindfulness"
              secondary="Wbudowany timer medytacji z Electron notifications i bio logging"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <CheckCircleIcon color="success" />
            </ListItemIcon>
            <ListItemText
              primary="Idle Detection"
              secondary="System monitor + powerMonitor API - wykrywanie bezczynności z opcją odliczenia idle time"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <CheckCircleIcon color="success" />
            </ListItemIcon>
            <ListItemText
              primary="App Activity Monitoring"
              secondary="Tracking aktywnych aplikacji (macOS/Windows) z kategoryzacją produktywności"
            />
          </ListItem>
        </List>
      </Paper>

      {/* Technology Stack */}
      <Paper sx={{ p: 3, mt: 3, bgcolor: '#f5f5f5' }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 500, mb: 2 }}>
          Stack Technologiczny
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
              Frontend
            </Typography>
            <Chip label="React 18" sx={{ m: 0.5 }} />
            <Chip label="TypeScript" sx={{ m: 0.5 }} />
            <Chip label="Material-UI v5" sx={{ m: 0.5 }} />
            <Chip label="React Router" sx={{ m: 0.5 }} />
            <Chip label="MUI X DataGrid" sx={{ m: 0.5 }} />
            <Chip label="Chart.js" sx={{ m: 0.5 }} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
              Backend & Desktop
            </Typography>
            <Chip label="Electron" sx={{ m: 0.5 }} />
            <Chip label="Node.js" sx={{ m: 0.5 }} />
            <Chip label="SQL.js (SQLite)" sx={{ m: 0.5 }} />
            <Chip label="electron-log" sx={{ m: 0.5 }} />
            <Chip label="powerMonitor API" sx={{ m: 0.5 }} />
          </Grid>
          <Grid item xs={12}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
              Machine Learning & AI
            </Typography>
            <Chip label="TensorFlow.js" color="primary" sx={{ m: 0.5 }} />
            <Chip label="Custom Statistical ML Algorithms" sx={{ m: 0.5 }} />
            <Chip label="NLP Templates Engine" sx={{ m: 0.5 }} />
          </Grid>
        </Grid>
      </Paper>

      {/* Footer */}
      <Box sx={{ mt: 4, textAlign: 'center', color: 'text.secondary' }}>
        <Divider sx={{ mb: 2 }} />
        <Typography variant="body2">
          Thingy Productivity App - v1.0
          <br />
          Powered by TensorFlow.js & Custom ML Algorithms
        </Typography>
      </Box>
    </Box>
  );
}

export default About;
