Najciekawsze obecnie są:

| Usługa          | Konto                               | Upload API                   | „Kto ma link”                 | Czas życia free   | Multi-file    |
| --------------- | ----------------------------------- | ---------------------------- | ----------------------------- | ----------------- | ------------- |
| **ship.page**   | nie                                 | **tak, banalne `curl POST`** | losowy, niezgadywalny URL     | **7 dni**         | tak, ZIP/JSON |
| **Sitebin**     | nie                                 | **tak**                      | losowy URL, opcjonalnie hasło | **7 dni**         | tak           |
| Netlify Drop    | nie dla prostych statycznych plików | raczej nie ten use-case      | publiczny URL                 | bezterminowo free | tak           |
| Cloudflare Drop | nie                                 | głównie drag&drop            | losowy URL                    | ok. **60 min**    | tak           |

### 1\. `ship.page` — chyba dokładnie tego szukasz

To jest wręcz absurdalnie dobrze dopasowane:

Bash

curl \-X POST https://ship.page/deploy \\

  \-H "Content-Type: text/html" \\

  \--data-binary @report.html

Dostajesz coś w rodzaju:

https://vast-juice-c2dse08p.shipped.page/

Bez konta, bez logowania, bez tokena API. Możesz wysłać pojedynczy HTML, ZIP albo zestaw plików przez JSON. Darmowy upload może mieć do 25 MB ZIP / 100 MB po rozpakowaniu i maksymalnie 100 plików. ![](https://www.google.com/s2/favicons?domain=https://ship.page&sz=128)ship.page

Co ważniejsze, ich model prywatności jest dokładnie typu **capability URL**:

> znajomość adresu = dostęp

Losowy URL ma według nich około **62 bitów entropii**, więc praktycznie nie da się go odgadnąć brute-force. Nie jest to jednak autoryzacja w sensie kryptograficznym: **każdy, kto dostanie link, widzi stronę**. ![](https://www.google.com/s2/favicons?domain=https://ship.page&sz=128)ship.page

Minus: anonimowe darmowe deploye **znikają po 7 dniach**. Możesz też ustawić krótszy TTL.

Czyli np.:

Bash

curl \-X POST "https://ship.page/deploy?ttl=3600" \\

  \-H "Content-Type: text/html" \\

  \--data-binary @raport.html

i masz stronę na godzinę. ![](https://www.google.com/s2/favicons?domain=https://ship.page&sz=128)ship.page

### 2\. `Sitebin.io` — jeszcze ciekawsze, jeśli chcesz później edytować

Sitebin działa podobnie, ale ma bardziej rozbudowaną koncepcję „anonimowej strony”.

Upload:

Bash

curl \-F "files=@index.html" https://app.sitebin.io/...

Po utworzeniu dostajesz **view URL + edit URL + edit password**. Nie potrzebujesz konta. Możesz potem aktualizować zawartość przez przeglądarkę, API, WebDAV albo FTP. ![](https://www.google.com/s2/favicons?domain=https://sitebin.io&sz=128)Sitebin

Co szczególnie pasuje do Twojego wymagania: można ustawić również **hasło do oglądania strony**, datę wygaśnięcia i licznik odsłon. Darmowy anonimowy hosting również wygasa po **7 dniach**, limit to 25 MB na stronę. ![](https://www.google.com/s2/favicons?domain=https://sitebin.io&sz=128)Sitebin

Więc jeśli przez:

> „tylko osoby posiadające link”

masz na myśli **unguessable URL**, ship.page jest prostszy.

Jeżeli masz na myśli:

> link + faktyczne zabezpieczenie hasłem

to **Sitebin jest lepszy**.

### Netlify Drop też częściowo spełnia warunki

Netlify ma obecnie Drop, gdzie możesz wrzucić `index.html`, folder albo ZIP i dostać stronę **bez zakładania konta**. ![](https://www.google.com/s2/favicons?domain=https://app.netlify.com&sz=128)Netlify+1

Ale to już mniej pasuje do Twojej koncepcji „anonimowe API → URL”. Domyślne linki są po prostu **publicznie dostępne**. Netlify oferuje kontrolę dostępu/password protection, ale wtedy wchodzisz już głębiej w ich normalny model konta/projektu. ![](https://www.google.com/s2/favicons?domain=https://app.netlify.com&sz=128)Netlify

### Jest jeszcze Cloudflare Drop

Cloudflare uruchomił anonimowy Drop: drag&drop statycznego HTML/CSS/JS, bez konta, dostajesz URL. Problem: anonimowy deploy żyje tylko około **60 minut**, jeśli go nie „claimniesz” przez konto. ![](https://www.google.com/s2/favicons?domain=https://pinggy.io&sz=128)Pinggy

Czyli bardziej:

> „Bob, pokaż mi tę wygenerowaną stronę na telefonie”

niż:

> „hostuj mi raport przez tydzień”.

---

**Ja bym brał `ship.page` do automatyzacji.**

To wręcz otwiera bardzo fajny workflow:

ChatGPT / Claude / skrypt

        ↓

generuje report.html

        ↓

POST ship.page/deploy

        ↓

https://random-random-xyz.shipped.page

        ↓

wysyłasz komuś link

        ↓

7 dni później → znika

Bez GitHuba, repozytorium, CI, kont hostingowych i całego korporacyjnego kabaretu.

Jedno istotne zastrzeżenie: **„unguessable link” ≠ hosting danych poufnych**. Jeśli wrzucasz raport zawierający dane pacjenta, dane medyczne, PESEL-e itd., nie traktowałbym żadnej z tych anonimowych usług jako bezpiecznego magazynu tylko dlatego, że URL jest losowy. Capability URL świetnie nadaje się do **niepublicznych demonstracji, raportów bez danych wrażliwych, prototypów i jednorazowych wizualizacji**. ![](https://www.google.com/s2/favicons?domain=https://ship.page&sz=128)ship.page+1

Natomiast do Twojego prawdopodobnego use-case'u typu **„wygenerowałem komuś interaktywny HTML i chcę jednym requestem zrobić z niego shareable link”** — `ship.page` wygląda niemal podejrzanie idealnie.
