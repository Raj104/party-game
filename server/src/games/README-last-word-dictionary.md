# Last Word word-list expansion

Edit `lastWordExtraWords.txt`, one word on each line (UTF-8). The server reads
this file **once when it starts**, lowercases entries, removes duplicates and
ignores anything that is not 4–16 unaccented English letters (A–Z).

The expanded **188,260-word** list can be used here. Paste it into the file, save,
then restart the server. No per-turn lookup over the whole list is needed:
the server constructs prompt-answer indexes at startup. Large files can make
the **first startup slower** and use more RAM, so test before deploying.

A huge word list can also accept obscure spellings, proper nouns and jargon.
Prefer a high-quality, curated list with common English inflections and
plurals. Add personal exceptions to the same file and check that the source
list's license permits redistribution.

If desired, include these words in your custom list (they were previously stored separately):

```text
underwear
busted
shoemaker
```

For changes after the server starts, restart the process to rebuild indexes.
Your `lastWordExtraWords.txt` file is intentionally **not overwritten** by patch releases.
There is no separate `lastWordCommonWords.txt` dependency. Keep any custom additions in `lastWordExtraWords.txt`.

No runtime database or network service is required.
