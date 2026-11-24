# news-app-podcast
Personal news podcast feed

## v2.2.2 podcast presentation

The channel author is Hixet Productions; the podcast remains Escape the Cave at its existing RSS URL with the existing artwork. The Weather in Scotland description uses podcast HTML, one introductory subject heading and linked sources. Its original audio, GUID and publication date are retained. Other episode descriptions are unchanged by this correction.

Non-chargeable tests require Node 22 or newer and `xmllint` (libxml2):

```sh
node --test test/*.test.mjs
xmllint --noout --nonet feed.xml
```

The Daily publisher retains the revised channel metadata and existing Research HTML. Its production code and schedule are unchanged. Merging the metadata correction requires explicit approval because the repository's existing Pages hosting publishes `main`.
