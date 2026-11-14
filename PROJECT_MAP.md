# Mapa projektu

Aktualizuj ten plik po każdej istotnej zmianie. Ostatnia aktualizacja: 2026-11-13 (scena 3D Marsa, wydajność i kamera).

## Stos i skrypty

- Serwer: Node 22 + TypeScript (`src/server`), baza SQLite (`db/game.db`, `better-sqlite3`), alternatywnie PostgreSQL lub pliki lokalne.
- Klient: Vue 3 (Options API i `<script setup>`), Webpack, Less (`src/styles`, kompilowane przez `lessc` do `build/styles.css`), three.js 0.170 dla sceny Marsa.
- Wspólne typy: `src/common`.
- `npm run build` pełny build; `npm run build:client` (karty + webpack produkcyjny); `npm run build:server`; `npm run make:css` (Less do `build/styles.css`, nie przechodzi przez webpack); `npm run make:json` (tłumaczenia i dane statyczne do `src/genfiles`).
- `npm run dev` uruchamia watchery serwera, klienta, CSS i kart.
- Testy: `npm run test:server` (Mocha), `npm run test:client` / `npx vitest run` (Vitest + jsdom), `npm run lint:client` (vue-tsc), `npm run lint:server` (ESLint).
- Na tej maszynie domyślny `node` to wersja 24, a `better-sqlite3` jest zbudowany pod Node 22. Serwer i skrypty z bazą uruchamiaj binarką Node 22: `C:/Users/Andre/AppData/Local/npm-cache/_npx/e609a7c1edf98e65/node_modules/node/bin/node.exe`.

## Struktura katalogów

- `src/server/` silnik gry, karty (`cards/<moduł>`), plansze (`boards`), wejścia gracza (`inputs`), baza (`database`), trasy HTTP, narzędzia (`tools`).
- `src/client/components/` ekrany Vue. `PlayerHome.vue` to główny widok partii.
- `src/client/components/board/` plansza Marsa w trybie misji: `AtlasBoard`, `MarsSurface`, `BoardGeometry`, `mars/` (scena 3D), `MissionHand`, `MissionPlayerHud`, `MissionCardStage`.
- `src/client/components/card/` renderowanie kart (`Card.vue`, `CardArt.vue` i elementy treści).
- `src/client/components/logpanel/ActivityFeed.vue`, `overview/RivalPanel.vue`, `MissionSettings.vue` elementy HUD.
- HUD w trybie misji (`board/`): `MissionPlayersPanel` (gracze, lewy górny róg), prawa kolumna `MissionParameters` (tory i bonusy) + `MissionTurnButton` (tura, licznik akcji, zegar), `MissionStandardProjects` (projekty u góry), `MissionHudMenus` (okna: nagrody, kamienie, zagrane karty, akcje kart, sprzedaż), `MissionPinnedCards` (karty odłożone z ręki, układy 1-3), `MissionPlacementBanner` (jeden baner dla każdego stawiania kafelka), `common/DialogPeek` („Pokaż grę” w oknach wyboru).
- Style: `src/styles/mission-hud-layout.less` (układ HUD-a, ładowany z `PlayerHome.vue`) i `src/styles/game-dialogs.less` (okna gry, ładowane z `App.vue`). Oba są w paczce klienta, nie w `common.less`: zmiana wymaga tylko buildu klienta. Komponenty trzymają własny wygląd w stylach scoped.
- `src/client/utils/SoundManager.ts` odtwarza dźwięki misji i zapętla trzy utwory MP3 z `assets/audio/`. Głośność i źródło muzyki można zmienić w `MissionSettings`.
- `src/styles/mission-*.less` style trybu misji (`mission-map.less` scena i plansza, `mission-cinematic.less` układ ekranu, `mission-orbit-layout.less`, `mission-hand.less`, `mission-player-hud.less`, `mission-card-frame.less`).
- `tests/client/` testy komponentów, `tests/` testy serwera.

## Kluczowe moduły

- `PlayerHome.vue` włącza tryb kinowy (`mission-cinematic`), gdy gracz ma korporację i partia trwa. Udostępnia przez `provide(mapPlacementKey)` bieżące wejście `SelectSpace`, z którego plansza bierze legalne pola.
- `AtlasBoard.vue` składa widok planszy: `MarsSurface` (scena), `Board` (pola i zdarzenia), przyciski kamery, dok stacji orbitalnych, podpowiedź sektora i panel bieżącej akcji. Obsługuje klawisze kamery `+`, `-`, `0`/`Home` na całej scenie i strzałki w grupie przycisków kamery.
- `Board.vue` pozostaje źródłem interakcji: renderuje pola DOM (`[data_space_id]`), emituje `inspectSpace`, obsługuje klawiaturę po polach i teleportuje pola orbitalne do doku AtlasBoard. W trybie sceny ma klasę `board--scene`.
- `MarsSurface.vue` jest właścicielem sceny i kamery. Tworzy `MarsScene`, przekazuje jej stan partii i podświetlenia, obsługuje wskaźnik (przeciąganie z progiem 6 px, tłumienie kliknięcia po przeciągnięciu, szczypanie, kółko) i po każdej zmianie kamery układa pola DOM oraz przyciski stacji orbitalnych. Bez WebGL (np. jsdom w testach) i w widoku `Tracks` pokazuje klasyczną płaską planszę.
- HUD: `MissionPlayerHud` (zasoby, produkcja, ręka), `MissionHand` (wachlarz kart), `ActivityFeed`, `RivalPanel`, `MissionSettings` (muzyka, głośność). Karty w ręce to prawdziwe `CardModel`.

## Przepływ stanu gry

Serwer rozstrzyga reguły. Klient pobiera `PlayerViewModel` z `/api/player?id=...`. `game.spaces` (`SpaceModel[]`) opisuje pola i kafelki, `waitingFor` opisuje decyzję gracza. Kliknięcie pola przechodzi przez `Board` do `SelectSpace`, który pokazuje potwierdzenie gry i wysyła wybór. Po odpowiedzi serwera nowy `game.spaces` trafia do `AtlasBoard`, a stamtąd do `MarsSurface` i sceny.

## Renderowanie planszy (scena 3D)

- `BoardGeometry.ts` jest jedyną geometrią planszy. Odtwarza pozycje z `board_items_positions.less` (rzędy co 41 px, pola co 49 px, wcięcie pół pola na rząd od środka; plansza standardowa 61 pól, Amazonis 91). Każde pole ma kolumnę siatki w podwójnych współrzędnych, środek `x, y` i pozycję lewego górnego rogu. Test `tests/client/components/board/BoardGeometry.spec.ts` pilnuje zgodności z plikiem Less.
- `mars/MarsScene.ts` (three.js): kula Marsa o promieniu 1, plansza nawinięta rzutem gnomonicznym wokół środka planszy (skala 0,00105 jednostki na piksel planszy). Ta sama funkcja `surface(x, y)` ustawia teren, siatkę, kopuły, cienie i pola DOM.
- Jedno słońce (`SUN`): z lewej strony, nisko nad planszą. Ten sam kierunek trafia do shadera powierzchni, `DirectionalLight` dla obiektów 3D i do rzutu cieni budowli w teksturze stanu. Światło ciepłe, cień chłodny.
- `mars/planetShader.ts`: relief proceduralny (fbm, grzbiety, kilka skal kraterów z ciągłym poziomem szczegółów zależnym od wielkości piksela), bump z pochodnych ekranowych, albedo pyłu, bazaltu i den kraterów, woda (płycizna, głębia, odbicie nieba, ruchomy odblask słońca, mokry brzeg), roślinność z przejściem przez rzadką zarośl, grunt osad, siatka heksów liczona analitycznie z siatki pól, mgiełka przy horyzoncie i osobna powłoka atmosfery z niebieską poświatą krawędzi.
- `mars/TerrainState.ts` zamienia `game.spaces` na teksturę w przestrzeni planszy: R ocean, G zieleń, B grunt osady, A cień i zacienienie kontaktowe kopuł. Pola są powiększonymi, rozmytymi heksami, więc sąsiednie oceany i łąki łączą się, a shader zniekształca granice szumem, aby linia brzegowa przekraczała krawędzie heksów. Druga tekstura ma jeden teksel na pole: istnieje, legalne, wskazane, rezerwa oceanu.
- Kopuły: każde miasto to główna kopuła i 2 do 3 mniejszych (deterministycznie z id pola), z podstawą, przezroczystym szkłem, ożebrowaniem, ogrodem w środku i migoczącymi światłami.
- Stacje orbitalne (pola `COLONY`, np. Phobos i Ganimedes): obiekty 3D w przestrzeni świata. Ich położenie wyznacza raz kamera domyślna: tuż nad krawędzią Marsa po bokach kadru, Phobos przed krawędzią, Ganimedes daleko za nią (wschodzi zza planety), nigdy pod górnym HUD. Potem są nieruchome, więc przy oddaleniu widać je obok globu, a przy przesuwaniu mogą wypaść z kadru. Przyciski DOM stacji ustawia projekcja ich pozycji, ukrywane są za planetą lub poza ekranem.
- Pola DOM: każde pole dostaje `transform: matrix(...)` wyliczone z rzutu środka i dwóch sąsiednich punktów (afiniczne przybliżenie płaszczyzny stycznej), `transform-origin: 0 0`, `clip-path` heksu. Trafienie myszą w widoczny heks jest więc liczone przez przeglądarkę na tym samym kształcie, który rysuje scena. Pola za horyzontem są ukryte. Zmienna `--space-scale` utrzymuje stały rozmiar znaczników właściciela i ikon premii przy zoomie.

## Kamera

- Stan: cel `(x, y)` we współrzędnych planszy i odległość `d`. Nachylenie zależy od `d`: z bliska kamera patrzy pod ostrym kątem (66°), z daleka prawie z góry.
- Punkt główny projekcji jest przesunięty do środka bezpiecznego obszaru między panelami HUD. Bezpieczny obszar to ukryty element `.mars-surface__safe` ustawiany zmiennymi `--scene-safe-*` w `mission-map.less` (osobne wartości dla szerokiego i wąskiego ekranu).
- Kadr domyślny to najbliższa odległość, przy której cała plansza mieści się w bezpiecznym obszarze. Przeliczany przy zmianie rozmiaru.
- Ruch: przeciąganie przesuwa tak, by punkt pod kursorem został pod kursorem; kółko i szczypanie przybliżają do punktu pod kursorem; przyciski `−`, `⌖`, `+`; klawisze `+`, `-`, `0`/`Home` działają globalnie (poza polami tekstowymi i otwartymi dialogami), strzałki w grupie przycisków kamery. Granice: z bliska cel zostaje w obrysie planszy, po oddaleniu zakres rośnie (do 1400 px planszy poza obrys), więc przeciąganie obraca glob; `d` od 0,03 (kilka pól) do 4,2 (cała planeta). Niepoprawny stan kamery (NaN) wraca do kadru domyślnego. Fokus pola z klawiatury przesuwa kamerę, gdy pole jest poza bezpiecznym obszarem.
- Wygładzanie wykładnicze; bez `prefers-reduced-motion` scena renderuje się w spoczynku z częstotliwością około 15 kl./s (tylko w widocznej karcie) tylko dla animacji otoczenia (falowanie wody, światła osad, rzadki przelot wahadłowca). Kamera stoi, gdy gracz nic nie robi. Przy `prefers-reduced-motion` ruch kamery jest natychmiastowy, a animacje otoczenia zatrzymane.

## Wydajność

- Koszt sceny to shader powierzchni razy liczba pikseli. Pomiar 2026-11-13 (1440×900, DPR 1, czas GPU klatki): przed optymalizacją 9 / 13 / 15 / 17 ms (pełne oddalenie / kadr domyślny / średni zoom / zbliżenie), po niej 7 / 9 / 12,5 / 16 ms.
- Optymalizacje: szum brzegów wody i zieleni liczony tylko tam, gdzie tekstura stanu ma wartości (próbka w promieniu 24 px), roślinność tylko na zieleni, siatka tylko w obrysie planszy, limit 11 oktaw, DPR ograniczony do 1,5, adaptacyjna rozdzielczość podczas ruchu kamery (od 50% do 100%, spada przy klatkach powyżej 26 ms, wraca przy klatkach poniżej 18 ms), zmienna `--space-scale` zapisywana tylko przy zmianie powyżej 3%.
- Diagnostyka: `/player?id=...&scene-debug` udostępnia scenę jako `window.marsScene` (stan kamery, renderer).

## Fixture i podgląd

- `src/server/tools/seed_mission_scene.ts` zapisuje do lokalnej bazy trzy partie (ponowne uruchomienie je nadpisuje):
  - `/player?id=pmsraw1` surowy Mars (Tharsis), gracz ma decyzję o postawieniu zieleni,
  - `/player?id=pmsdev1` rozwinięty Tharsis: połączone morze, zieleń przy brzegu, cztery miasta z kopułami,
  - `/player?id=pmsama1` rozwinięta Amazonis Planitia.
- Uruchomienie: `<node22> --import tsx src/server/tools/seed_mission_scene.ts`, potem restart serwera (serwer wczytuje identyfikatory przy starcie).
- Podgląd: `npm run make:css`, `npx cross-env NODE_ENV=development webpack --watch`, serwer `PORT=8091 <node22> build/src/server/server.js`, adres `http://localhost:8091/player?id=pmsdev1`.
- Serwer w trybie innym niż produkcyjny serwuje pliki z `build/` bez pamięci podręcznej, ale `main.js` wskazuje na chunki z ostatniego buildu. Gdy dwa procesy budują naraz (watcher deweloperski i `build:client`), wygrywa ostatni zapis i karta może dostać inny kod niż oczekiwany. Po zmianach zrób jeden build i przeładuj karty.
- Uwaga: baza jest współdzielona przez wszystkie lokalne serwery, a fixture'y są normalnymi partiami, więc klikanie w nich zmienia ich stan. Uruchom seed ponownie, aby wrócić do stanu wyjściowego.

## Testy

- `npx vitest run tests/client/components/Board.spec.ts tests/client/components/board/BoardGeometry.spec.ts tests/client/components/AtlasBoard.spec.ts`.
- `npm run lint:client`.
- W jsdom nie ma WebGL, więc testy komponentów montują płaską planszę; scenę sprawdzaj w przeglądarce (szeroki i wąski ekran, przesuwanie, zoom, reset, wskazanie i zatwierdzenie pola, klawiatura, stacje orbitalne, Amazonis).

## Karty: skiny i powód blokady

- Preferencja `card_skin` (`PreferencesManager.ts`, wybór w ustawieniach misji): `classic` (domyślny) to oryginalna karta webowa 1:1 z detalami wzoru: jasnoszare tło z wyblakłą szarą mapą Marsa, numer karty obok kosztu, ciemna plakietka punktów z Marsem (`.card-skin--classic` w `mission-card-frame.less`); `printed` (wcześniejszy domyślny, z ilustracją) i `arena` zostają jako opcje.
- `Card.vue`: `framed` = karta projektu w ręce lub podglądzie (`art`), `showArt` = ramka z ilustracją tylko dla `printed` i `arena`.
- `src/client/utils/CardPlayBlockers.ts` wyjaśnia, czemu karty nie da się zagrać (faza, pas, nie Twoja tura, inna decyzja, wymagania globalne, tagi, produkcja, TR, brak M€ z uwzględnieniem stali i tytanu, inaczej ogólny powód efektu). `MissionCardStage` pokazuje listę pod kartą. Test: `tests/client/utils/CardPlayBlockers.spec.ts`.
- Testy w grze robi użytkownik; po zmianach buduj i zostaw serwer na porcie 8091.

## Feed aktywności

- Serwer: `GameLogs.getActivity` (`src/server/routes/GameLogs.ts`, `/api/game/logs?view=activity`) idzie po logu chronologicznie i do każdego wpisu dokłada `spent` (płatność z komunikatu „played … [ … ]”), `effects` (zmiany zasobów, produkcji i TR gracza aż do następnego wpisu) i `targets` (zmiany u innych graczy), jako skróty ikon `:r:`, `:p:`, `:i:tr:`. Test: `tests/routes/ApiGameLogs.spec.ts`.
- Klient: `logpanel/ActivityFeed.vue` pokazuje wpis w jednym zawijanym wierszu: kto, co, karta lub obiekt, wydatek, zyski, „→ gracz: zmiany”. Panel bez tła, każdy wiersz ma własne półprzezroczyste tło. Karta pojawia się po najechaniu lub fokusie, bez ramki popupu; kliknięcie lub dotknięcie przypina ją do następnego kliknięcia albo Escape.
- Nie wszystkie efekty kart zapisują zmiany zasobów w logu (`{log: true}`), więc część zysków może się nie pokazać.

## Znane problemy i otwarte wątki

- 2026-11-13: `tests/client/components/PlayerHome.spec.ts` (4 testy, brak `PlayerInputFactory` w stubach) i `tests/client/SoundManager.spec.ts` (1 test) nie przechodzą z powodu niezatwierdzonych zmian równoległej pracy nad kartami i dźwiękiem, nie sceny.
- Równolegle trwa przebudowa systemu kart (podgląd karty bez popupu, `MissionCardStage`, `CardArt`, `PaymentForm`, `MissionHand`).
- Różnice sceny względem referencji (scena powstała z opisu, bez obrazu referencyjnego):
  - relief jest bump mapą bez przesunięcia wierzchołków, więc sylwetka horyzontu jest gładka, a grzbiety nie rzucają własnych cieni;
  - kratery są proceduralne i dość regularne w rozkładzie; brak dużych form (kaniony, wulkany Tharsis) i warstwowania osadów;
  - atmosfera jest przybliżeniem analitycznym (bez rozpraszania wielokrotnego), poświata jest cienka, ale jednolita w kolorze;
  - cienie kopuł są rysowane w teksturze stanu, nie przez mapę cieni; kopuły nie cieniują się wzajemnie;
  - Ganimedes używa tekstury `assets/colonies-planets/ganymede.jpg`, która nie jest mapą równokątną;
  - przy pełnym oddaleniu Ganimedes leży za kamerą, dostęp do niego daje przycisk przywrócenia kadru;
  - specjalne kafelki (np. Mohole, kopalnie) nadal są grafiką DOM nałożoną na powierzchnię, a nie obiektami 3D.
