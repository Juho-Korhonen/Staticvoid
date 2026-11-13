# Dataset M — History of Finland, every version

Every saved version of the Finnish Wikipedia articles on the history of Finland, from the
`pages-meta-history` dump of 1 October 2026: 862,076 versions of 19,742 articles,
12.2 GB of wikitext in 16 Parquet files of 315 MB in all (zstd: consecutive
versions of an article are nearly identical, so they compress very well). Built by `dataset_m.py` in https://github.com/MariaDB/mariadb-wikipedia-datasets.

One row per version, oldest first within each article. Columns: page_id, title (as it was then),
rev_id, parent_id, timestamp (UTC, when the version was saved), user (name, IP address or
temporary account), anonymous (IP address or temporary account), comment (edit summary), minor,
sha1 (same hash = same text), bytes, text (wikitext).

Source: Wikimedia dumps, https://dumps.wikimedia.org/fiwiki/20261001/
Licence: Wikipedia text is CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/).
Credit Wikipedia and its authors; each version's authors are listed on
https://fi.wikipedia.org/w/index.php?curid=<page_id>&action=history
