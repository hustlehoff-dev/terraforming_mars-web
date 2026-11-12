# Bank zadań — Terraforming Mars

Zadania do wdrożenia przez osobnego agenta. Odhacz zadanie po sprawdzeniu kryteriów odbioru.

Po odhaczeniu zadania dopisz jego numer i pełny tytuł do [Do akceptacji](DO_AKCEPTACJI.md) w formacie `- TM-NNN — Tytuł zadania`. Każdy numer wpisuj tylko raz.

## TM-001 — Kompaktowe kafelki innych graczy

- [x] Wykonane

W górnym rogu ekranu rozgrywki dodaj subtelny panel z maksymalnie czterema szerokimi, niskimi kafelkami ułożonymi jeden pod drugim. Gracz może szybko sprawdzić stan rywali bez opuszczania planszy.

Kryteria odbioru:

- Każdy kafelek pokazuje nick oraz aktualne stany sześciu podstawowych zasobów: M€, stali, tytanu, roślin, energii i ciepła. Ikony pozwalają rozpoznać zasoby.
- Kliknięcie lub aktywacja z klawiatury otwiera podgląd publicznie widocznych zagranych kart wybranego gracza. Podgląd można zamknąć bez opuszczania planszy; dla pustej listy pokazuje się komunikat. Ręka i inne ukryte karty pozostają niewidoczne.
- Panel pomija własny kafelek i nie pokazuje pustych miejsc. W solo jest ukryty. Jeśli rywali jest więcej niż czterech, dostęp do pozostałych zapewnia przycisk „+N”.
- Panel mieści się także na wąskim ekranie i nie zasłania przycisków rozgrywki. Wartości aktualizują się wraz ze stanem gry.

Punkt startowy: `PlayerHome.vue` ma już pasek graczy i `PlayersOverview.vue`. Sprawdź możliwość ponownego użycia istniejących widoków gracza i kart.

## TM-002 — Wskaźnik aktywnego gracza

- [x] Wykonane

Pokaż, kto ma turę: subtelny efekt przy nicku oraz czytelna etykieta „Teraz gra”.

Kryteria odbioru:

- Po zmianie tury oznaczenie automatycznie przenosi się na aktywnego rywala. Jeśli jest poza pierwszymi czterema kafelkami, jego nick i status są widoczne również w zwiniętym panelu.
- Gdy turę ma osoba oglądająca planszę, w nagłówku rozgrywki widać „Twoja tura”; żaden kafelek rywala nie jest podświetlony.
- W fazach bez indywidualnej tury nie ma oznaczenia „Teraz gra”. Status da się rozpoznać bez koloru i animacji; animacja respektuje ustawienie ograniczonego ruchu.

Punkt startowy: `player.isActive` i bieżąca faza gry. Nie wyznaczaj aktywnego gracza na podstawie kolejności kafelków.

## TM-003 — Licznik tur w generacji

- [x] Wykonane

Obok istniejącego numeru generacji pokaż numer bieżącej tury w fazie akcji, np. „Generacja 4 · Tura 7”. Przyjęta definicja: licznik obejmuje kolejne tury wszystkich graczy w tej generacji.

Kryteria odbioru:

- Pierwsza tura akcji w każdej generacji ma numer 1. Licznik rośnie o 1 przy rozpoczęciu kolejnej tury, również gdy po spasowaniu rywali znów gra ta sama osoba.
- Druga akcja w tej samej turze, otwarcie podglądu i odświeżenie strony nie zwiększają numeru. Poza fazą akcji licznik tury jest ukryty.
- Wszyscy gracze widzą ten sam numer. Zapis i wczytanie gry zachowują licznik, a starsze zapisy nadal się wczytują.

Sprawdzenie: przejdź przez turę z dwiema akcjami, przekazanie tury, pas, zapis i wczytanie oraz początek nowej generacji.

## TM-004 — Podgląd kafelka planszy przy kursorze

- [x] Wykonane

Przenieś informacje o polu planszy z bocznego inspektora do małej podpowiedzi przy kursorze lub przy wskazanym heksie. Pokaż te same informacje o sektorze, terenie lub położonym kafelku oraz dostępnych bonusach.

**Kryteria odbioru**

- Najechanie na pole pokazuje podpowiedź przy nim. Przejście na inne pole zmienia jej treść, a opuszczenie pola ją chowa. Przy krawędzi ekranu podpowiedź zmienia stronę, żeby pozostać widoczna.
- Fokus klawiatury wyświetla podpowiedź przy heksie. Na ekranie dotykowym da się podejrzeć pole przez dotknięcie, z zachowaniem dotychczasowego sposobu zatwierdzania ruchu.
- Podpowiedź nie przechwytuje kliknięć ani nie utrudnia wyboru pola. Kontrolki widoku planszy pozostają dostępne po przeniesieniu treści z bocznego inspektora.

Punkt startowy to `AtlasBoard.vue` i zdarzenie `inspectSpace` w `Board.vue`.

## TM-005 — Liczniki parametrów końca terraformowania

- [x] Wykonane

Dopracuj istniejące liczniki w nagłówku HUD, żeby od razu było widać aktualną temperaturę w °C, poziom tlenu w % i liczbę oceanów wraz z wartościami docelowymi.

**Kryteria odbioru**

- Każdy licznik pokazuje bieżącą wartość, cel i czytelne oznaczenie osiągnięcia celu. Dane zmieniają się na bieżąco i odpowiadają limitom wybranej planszy.
- Jeśli ustawienia partii wymagają dodatkowych parametrów, np. ukończenia torów Wenus lub Księżyca, HUD uwzględnia je w informacji o postępie. Widok solo nadal pokazuje limit generacji.
- Osiągnięcie celów terraformowania i koniec partii są pokazane zgodnie z fazą gry i zasadami danego trybu.

Punkt startowy to `missionMetrics` w `PlayerHome.vue` oraz `marsIsTerraformed()` i `gameIsOver()` w `Game.ts`.

## TM-006 — Ocena widoku pozycji gracza w trakcie partii

- [x] Wykonane — decyzja produktowa

Automatyczna punktacja już działa. Serwer oblicza PZ przez `Player.getVictoryPoints()`. W trakcie gry własny wynik jest dostępny, a wyniki rywali zależą od opcji partii `showOtherPlayersVP`, która domyślnie jest wyłączona. Pasek graczy w `PlayerHome.vue` pokazuje obecnie wskaźnik terraformacji, a klasyfikacja w `GameEnd.vue` sortuje po PZ i rozstrzyga remis stanem M€.

**Kryteria odbioru**

- Oceń, czy bieżąca pozycja pomaga podejmować decyzje w trakcie gry. Uwzględnij, że wynik może się zmienić m.in. przez nagrody, kafelki i punktację naliczaną pod koniec partii.
- Zapisz decyzję z krótkim uzasadnieniem. Jeśli widok ma powstać, wykorzystaj istniejącą punktację, pokaż pozycję jako bieżącą i powiąż jej widoczność z opcją `showOtherPlayersVP`. Przy ukrytych PZ pozycja nie może ujawniać wyniku rywali pośrednio.

**Decyzja:** nie dodajemy pozycji w trakcie partii. Kolejność na podstawie aktualnych PZ może zmienić się po rozliczeniu nagród, punktacji kart i sąsiedztwa kafelków. Do bieżących decyzji przydają się widoczne zasoby, zagrane karty i postęp terraformacji. PZ rywali pozostają zależne od `showOtherPlayersVP`, a klasyfikacja po zakończeniu partii nadal rozstrzyga remisy stanem M€.

## TM-007 — Ujednolicenie ikon zasobów i ręki

- [x] Wykonane

Uporządkuj ikony interfejsu, zaczynając od sześciu podstawowych zasobów i ikon w widoku ręki. Ten sam zasób powinien mieć ten sam symbol w HUD, na kafelkach rywali i przy kartach.

**Kryteria odbioru**

- Ikony pozostają rozpoznawalne przy małych rozmiarach. Wartości zasobów, koszt karty, tagi i akcje widoku ręki da się odczytać bez polegania wyłącznie na kolorze.
- Wspólne ikony korzystają z tego samego zestawu zasobów graficznych lub komponentów. Przyciski ikonowe mają dostępne etykiety, a układ ręki mieści się na wąskim ekranie.

Punkt startowy to `PlayerResource.vue`, `MissionHand.vue` oraz kafelki z TM-001.

## TM-008 — Historia zagranych kart przy lewej krawędzi HUD

- [x] Wykonane

Dodaj przy lewej krawędzi ekranu wąski, wysoki, przewijany pasek ostatnio zagranych kart, wzorowany na historii rozgrywki w Hearthstone.

**Kryteria odbioru**

- Najnowsze publicznie widoczne zagrania są na górze. Wpis pozwala rozpoznać kartę i gracza, który ją zagrał. Starsze wpisy są dostępne po przewinięciu.
- Nowy wpis na krótko się podświetla. Najechanie lub fokus wyróżnia wskazany wpis i pokazuje podgląd karty. Przy ograniczonym ruchu podświetlenie działa bez animacji.
- Historia zachowuje kolejność po odświeżeniu i nie dubluje wpisów po aktualizacji stanu. Nowe zagranie nie przerywa przeglądania starszych wpisów. Przewijanie paska nie porusza planszą.
- Pasek nie zasłania kluczowych kontrolek. Wpisy pokazują wyłącznie informacje jawne zgodnie z zasadami widoczności kart i dziennika gry.

Punkt startowy to istniejący dziennik gry (`LogPanel.vue`, `GameLogs.ts`) i rejestrowane na serwerze zdarzenia zagrania kart.

## TM-009 — Oddalony widok Marsa z miejscem na stacje

- [x] Wykonane

Cofnij kamerę w domyślnym widoku rozgrywki. Pokaż więcej planety i zostaw wokół niej przestrzeń na stacje oraz inne pola poza powierzchnią Marsa. **To warunek odbioru sceny z TM-010.**

**Kryteria odbioru**

- Po wejściu do gry widać obrys planety, planszę i dostępne w danej partii stacje. Stacje nie są ucięte ani zasłonięte przez HUD, a ich nazwy da się odczytać.
- Heksy i dostępne pola stacji da się wskazać oraz wybrać na szerokim i wąskim ekranie. Efekty kamery zachowują zgodność między grafiką pola, podpowiedzią i obszarem kliknięcia.
- Sprawdź widok na zwykłej i dużej planszy, także w partii z dodatkowymi polami poza Marsem.

Punkt startowy to kadrowanie tła i skala planszy w `mission-cinematic.less`, układ w `AtlasBoard.vue` oraz pola `board-outer-spaces` w `Board.vue`.

## TM-010 — Stała aktywność na Marsie i orbicie

- [x] Wykonane

Scena ma żyć przez całą partię, również podczas czekania na ruch innego gracza. Dodaj widoczną aktywność w przestrzeni wokół Marsa oraz na jego powierzchni. Mogą to być przeloty wahadłowców, sygnały świetlne stacji lub powolny ruch pyłu nad planetą.

**Kryteria odbioru**

- Bez żadnej akcji gracza widać ciągły, delikatny ruch oraz co jakiś czas wyraźniejsze zdarzenie w scenie. Sprawdź to także podczas oczekiwania na turę.
- Świat reaguje również na stan gry. Przykładowo postawienie kafelka daje krótki efekt na danym heksie, a osiągnięcie celu terraformowania jest widoczne w scenie.
- Ruch dekoracji nie przesuwa pól ani stacji, z którymi gracz wchodzi w interakcję. Plansza zachowuje płynną obsługę na wąskim ekranie. Przy ograniczonym ruchu zmiany stanu są czytelne bez ruchomych dekoracji.

Punkt startowy to `mission-motion.less`, gdzie są już animacje światła i pyłu oraz efekt położenia kafelka.

## TM-011 — HUD reagujący na przebieg gry

- [x] Wykonane

Dodaj krótkie reakcje interfejsu na zmianę tury, zmianę wartości zasobu lub parametru oraz dobranie lub zagranie karty. Ruch ma kierować wzrok na konkretną zmianę.

**Kryteria odbioru**

- Aktualizacja podświetla właściwy element. Zmiana tury wyróżnia aktywnego gracza, zmiana licznika akcentuje nową wartość, a zagranie karty wyróżnia wpis w historii.
- Ponowne pobranie tego samego stanu nie uruchamia efektów. Animacje nie przesuwają kontrolek, nie przerywają przewijania i nie opóźniają kolejnej akcji.
- Przy ograniczonym ruchu zmianę nadal widać dzięki wartości, etykiecie lub statycznemu wyróżnieniu.

Punkt startowy to animacje liczników i ręki w `mission-motion.less` oraz aktualizacje stanu w `PlayerHome.vue`.

## TM-012 — Ekran wyboru korporacji

- [x] Wykonane

Przebuduj widok wyboru korporacji na początku partii według [referencji wizualnej](docs/references/wybor-korporacji.png). Umieść duże panele korporacji nad przyciemnionym widokiem Marsa. Każdy panel ma wyraźne logo i nazwę, a turkusowa ramka wyróżnia aktualny wybór.

**Kryteria odbioru**

- Na szerokim ekranie panele stoją obok siebie, żeby można było porównać korporacje. Na wąskim ekranie wszystkie dostępne opcje da się przejrzeć bez ucinania treści. Liczba paneli wynika z kart rozdanych w partii.
- Panel pokazuje opis, tagi oraz zasoby, produkcję i efekty startowe, które dotyczą danej korporacji. Ikony i wartości korzystają z danych kart oraz wzorów przyjętych w TM-007.
- Stan „Wybrano” widać także w tekście. Gracz może zmienić wybór przed zatwierdzeniem i obsłużyć ekran klawiaturą. Zmiana wyboru daje krótką reakcję wizualną spójną z TM-011.
- Potwierdzenie działa w ramach istniejącego wyboru kart startowych. Sprawdź partię standardową oraz partię z preludiami lub CEO, żeby zachować obowiązujące reguły wyboru i walidacji.

Punkt startowy to `SelectInitialCards.vue` i `PlayerSetupView.vue`.

## TM-013 — Ekran rozgrywki bez przewijania strony

- [x] Wykonane

Zmieść planszę i HUD w obszarze ekranu przeglądarki. Przenieś akcje i listę zagranych kart z sekcji pod planszą do paneli lub nakładek otwieranych z HUD-u.

**Kryteria odbioru**

- Kółko myszy, gest dotykowy, klawiatura i otwieranie paneli nie przewijają całego ekranu rozgrywki w dół. Przyciski „Akcje” i „Zagrane karty” otwierają odpowiedni panel w bieżącym widoku.
- Dłuższe listy przewijają się wewnątrz swoich paneli. Historia kart z TM-008 nadal przewija się w obrębie własnego paska.
- Na dużym i małym ekranie da się zagrać kartę, wybrać pole na planszy, przejrzeć karty i zakończyć turę bez przewijania strony.

Punkt startowy to `PlayerHome.vue`, w którym HUD odsyła dziś do sekcji pod planszą przez `#actions` i `#played-cards`.

## TM-014 — Stały HUD gracza na dole ekranu

- [x] Wykonane

Umieść HUD gracza na środku dolnej krawędzi ekranu. Po lewej stronie HUD-u pokaż kartę własnej korporacji, bezpośrednio obok stany zasobów, a w głównej części karty z ręki.

**Kryteria odbioru**

- HUD pozostaje w tym samym miejscu we własnej turze, podczas oczekiwania na rywali i po otwarciu paneli. Karta korporacji i zasoby są widoczne również przy pustej ręce.
- HUD pokazuje aktualne ilości M€, stali, tytanu, roślin, energii i ciepła. Przy dużej ręce lub na wąskim ekranie można przejrzeć wszystkie karty, a korporacja i zasoby pozostają widoczne.
- Z HUD-u można otworzyć pełny podgląd karty z ręki lub korporacji. Rozłożenie elementów pozostawia dostęp do pól planszy i stacji.

Punkt startowy to `mission-dock` w `PlayerHome.vue` oraz `MissionHand.vue`.

## TM-015 — Rzeczywiste karty we wszystkich widokach rozgrywki

- [x] Wykonane

W ręce, przy wyborze karty do zagrania, w podglądzie zagrania, na liście zagranych kart i w historii pokazuj konkretną kartę z gry. Widok kompaktowy może używać miniatury z nazwą i otwierać pełną kartę po wskazaniu lub wybraniu.

**Kryteria odbioru**

- Miniatura, nazwa, koszt, tagi i tekst reguł odpowiadają tej samej karcie. Pełny podgląd jest dostępny również z listy zagranych kart i historii.
- Po zatwierdzeniu zagrania widać, którą kartę zagrano. Wpis historii pozwala ponownie ją obejrzeć zgodnie z zasadami widoczności. Ręka rywala i ukryte karty pozostają prywatne.

Punkt startowy to `Card.vue` i `MissionHand.vue`, w którym miniatury ręki korzystają dziś z grafik dobieranych według tagów.

## TM-016 — Neonowa ramka kart dostępnych do użycia

- [x] Wykonane

Wyróżnij prostym neonowym obramowaniem, w stylu Hearthstone, karty z ręki, które gracz może teraz zagrać, oraz zagrane karty i korporacje, których akcję może teraz wykonać. Ramka oznacza dostępność według reguł gry.

**Kryteria odbioru**

- Wyróżnienie wynika z bieżących legalnych opcji gracza. Uwzględnia turę, koszty, warunki karty i to, czy akcja została już wykorzystana. Pasywne efekty bez akcji do wykonania nie dostają ramki.
- Ramka pojawia się lub znika po zmianie stanu. Sprawdź kartę, której kosztu nie można pokryć, zagraną kartę przed i po użyciu jej akcji oraz przejście tury na rywala.
- Status „Można zagrać” lub „Akcja dostępna” jest też dostępny tekstowo, a sama ramka może być statyczna.

Punkt startowy to opcje `projectCard` i `selectBlueCardAction` w `PlayerInputModel.ts` oraz lista akcji wyliczana przez serwer w `Player.ts`.
