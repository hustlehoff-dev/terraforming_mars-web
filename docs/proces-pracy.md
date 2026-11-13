# Proces pracy nad aplikacją

1. **Ustal zachowanie z punktu widzenia gracza.** Opisz, co gracz zobaczy, co może zrobić i jak poznamy, że działa. Przy zmianie wyglądu wskaż elementy referencji, które mają wpływ na rozgrywkę.
2. **Wyznacz granice komponentów.** Każdy komponent odpowiada za konkretną część ekranu i przyjmuje dane oraz przekazuje zdarzenia przez jawny interfejs. Wspólne dane lub geometrię trzymaj w jednym miejscu. Najpierw sprawdź, co można wykorzystać z istniejącego kodu.
3. **Podłącz prawdziwy stan gry.** Serwer rozstrzyga reguły i legalność ruchu. Komponent pokazuje ten stan, obsługuje wskazanie i przekazuje wybór do istniejącego mechanizmu rozgrywki. Grafika terenu może być dekoracyjna, ale pola, kafelki i podpowiedzi muszą odpowiadać faktycznej partii.
4. **Zbuduj i sprawdź cały przepływ.** Uruchom odpowiednie testy i zbuduj aplikację. W przeglądarce przejdź przez działanie, którego dotyczy zmiana. Sprawdź co najmniej szeroki i wąski ekran. Przy planszy porównaj położenie pól względem grafiki po zmianie rozmiaru oraz sprawdź klikanie, klawiaturę i dostęp do stacji orbitalnych.
5. **Zapisz sprawdzony efekt.** W opisie zmiany podaj, co działa, w jakich warunkach to sprawdzono i co pozostaje do weryfikacji. Zadania z banku odhaczaj po spełnieniu kryteriów. Numer i tytuł dopisz wtedy do [listy do akceptacji](../DO_AKCEPTACJI.md).

## Jak ten proces stosujemy do planszy Marsa

`MarsSurface` obejmuje tarczę planety i interaktywną planszę w jednej ramie 1280 × 720. Rozmiar okna zmienia skalę całej ramy. Heksy i ich obszary kliknięcia przesuwają się razem z odpowiadającym im terenem. Średnica tarczy uwzględnia standardową siatkę oraz większą planszę Amazonis Planitia.

`AtlasBoard` składa scenę z planszą, stacjami orbitalnymi, kontrolkami i podpowiedzią. `Board` nadal odpowiada za pola i zdarzenia gracza. Kontrolki i stacje mają własny układ ekranowy, ponieważ muszą pozostać dostępne po zmianie rozmiaru sceny.
