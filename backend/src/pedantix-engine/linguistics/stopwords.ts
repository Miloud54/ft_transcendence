/**
 * Function words. They stay hidden and can be guessed (exact/inflected match),
 * but they are never graded by semantic proximity: their vectors are not
 * informative and they would color half of the article.
 */
export const STOPWORDS: ReadonlySet<string> = new Set(
  `a about above after again against all am an and any are aren't as at be because
   been before being below between both but by can can't cannot could couldn't did
   didn't do does doesn't doing don't down during each few for from further had
   hadn't has hasn't have haven't having he her here hers herself him himself his
   how i if in into is isn't it its itself just me more most my myself no nor not
   of off on once only or other our ours ourselves out over own same she should
   shouldn't so some such than that the their theirs them themselves then there
   these they this those through to too under until up very was wasn't we were
   weren't what when where which while who whom why will with won't would wouldn't
   you your yours yourself yourselves also however thus although though whose
   among within without upon per via`
    .split(/\s+/)
    .filter(Boolean),
);
