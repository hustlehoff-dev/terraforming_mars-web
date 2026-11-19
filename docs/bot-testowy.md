# Bot do testów multiplayer

1. Przy tworzeniu gry wybierz co najmniej 2 graczy.
2. Przy przeciwniku zaznacz **Bot testowy**. Zostaw co najmniej jednego gracza ludzkiego.
3. Utwórz grę i otwórz swój link gracza. Widok bota nie musi być otwarty.

Bot jest zwykłym graczem multiplayer: korzysta z legalnych odpowiedzi na te same pytania co człowiek. Wybiera korporację, preludia, draftuje, kupuje i zagrywa karty, wybiera pola oraz pasuje. Podejmuje proste decyzje, bez strategicznej oceny kart. Wykonuje jedną odpowiedź co około 0,9 sekundy i zatrzymuje się podczas pauzy. Zgłasza zgodę na cofnięcie zainicjowane przez człowieka.

Ustawienie jest zapisane w partii. Otwarcie lub odświeżenie widoku gracza budzi bota również po restarcie serwera. Jeżeli bot nie potrafi odpowiedzieć, dodaje komunikat do logu i zatrzymuje się na tej decyzji. Otwórz wtedy jego link z pokoju i wybierz ręcznie; po zmianie pytania bot może kontynuować.
