# Prywatność

## Dane przetwarzane lokalnie

Rozszerzenie odczytuje widoczne wypowiedzi bieżącej rozmowy na `chatgpt.com` wyłącznie po to, aby wykonać wybraną przez użytkownika operację. Lokalne eksporty HTML i Markdown są generowane w karcie przeglądarki i zapisywane na urządzeniu. Na żądanie ta sama treść Markdown może zostać skopiowana do schowka. Rozszerzenie nie prowadzi własnej historii i nie używa analityki.

## Udostępnianie

Po wybraniu funkcji **Udostępnij** rozszerzenie pokazuje ostrzeżenie i wymaga potwierdzenia. Następnie wygenerowany statyczny HTML jest wysyłany do `https://ship.page/deploy`. Odpowiedź zawiera publicznie dostępny, trudny do odgadnięcia adres w domenie `shipped.page`.

W bezpłatnym wariancie publikacja wygasa po 7 dniach. Każda osoba znająca adres może odczytać zawartość. Rozszerzenie nie zapewnia hasła, szyfrowania end-to-end ani wcześniejszego usuwania anonimowej publikacji.

## Obrazy

Podczas generowania eksportu rozszerzenie może pobrać obrazy już widoczne w rozmowie z domen ChatGPT i OpenAI, aby osadzić je w pliku. Żądania są ograniczone listą dozwolonych hostów HTTPS. Obrazy spoza tej listy nie są pobierane przez service workera.

## Uprawnienia

- `clipboardWrite`: automatyczne kopiowanie gotowego linku oraz kopiowanie wybranego Markdown na żądanie;
- dostęp do `chatgpt.com`: odczyt bieżącej rozmowy i umieszczenie kontrolek w interfejsie;
- dostęp do `ship.page`: publikacja HTML dopiero po potwierdzeniu;
- dostęp do domen zasobów OpenAI: próba osadzenia obrazów w statycznym eksporcie.

Rozszerzenie nie odczytuje innych stron, historii przeglądania, plików lokalnych, ciasteczek ani haseł.
