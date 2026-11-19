# Bot do testów multiplayer

1. Przy tworzeniu gry wybierz co najmniej 2 graczy.
2. Przy przeciwniku zaznacz **Bot testowy**. Zostaw co najmniej jednego gracza ludzkiego.
3. Utwórz grę i otwórz swój link gracza. Widok bota nie musi być otwarty.

Bot jest zwykłym graczem multiplayer: korzysta z legalnych odpowiedzi na te same pytania co człowiek. Wykonuje jedną odpowiedź co około 0,9 sekundy i zatrzymuje się podczas pauzy. Zgłasza zgodę na cofnięcie zainicjowane przez człowieka.

Strategia ocenia koszt kart, produkcję względem pozostałego terraformowania, bieżące punkty, akcje kart, rabaty i synergie z korporacją. Wybiera korporację i preludia na podstawie własnych dostępnych kart; kupuje wybrane opłacalne projekty i zachowuje rezerwę pieniędzy. Przy stawianiu zieleni uwzględnia własne i cudze miasta, przy miastach otaczającą zieleń, a przy handlu wartość nagrody i opłaty. Finansuje nagrody, w których prowadzi, i ogranicza produkcję oraz surowce tracące wartość pod koniec gry.

To nadal heurystyka, nie wytrenowana sieć ani potwierdzony rankingiem silny przeciwnik. Efekty opisane przez `Behavior` są wyceniane bez uruchamiania akcji. Część indywidualnie zaimplementowanych kart ma przybliżoną ocenę. Bot nie podgląda rąk przeciwników ani kolejności talii. Ocena siły wymaga rozegranych partii; nie ma jeszcze wyników porównawczych.

Ustawienie jest zapisane w partii. Otwarcie lub odświeżenie widoku gracza budzi bota również po restarcie serwera. Jeżeli bot nie potrafi odpowiedzieć, dodaje komunikat do logu i zatrzymuje się na tej decyzji. Otwórz wtedy jego link z pokoju i wybierz ręcznie; po zmianie pytania bot może kontynuować.
