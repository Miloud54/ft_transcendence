import { LemmatizerService } from './lemmatizer.service';

describe('LemmatizerService', () => {
  const lemmatizer = new LemmatizerService();
  const same = (a: string, b: string) =>
    lemmatizer.lemmas(a).some((lemma) => lemmatizer.lemmas(b).includes(lemma));

  it.each([
    ['be', 'is'],
    ['is', 'are'],
    ['be', 'am'],
    ['be', 'was'],
    ['be', 'been'],
    ['be', 'being'],
    ['run', 'ran'],
    ['run', 'running'],
    ['run', 'runs'],
    ['child', 'children'],
    ['mouse', 'mice'],
    ['city', 'cities'],
    ['study', 'studied'],
    ['study', 'studies'],
    ['go', 'went'],
    ['take', 'taken'],
    ['build', 'built'],
    ['king', "king's"],
    ['big', 'bigger'],
  ])('%s and %s share a lemma', (a, b) => {
    expect(same(a, b)).toBe(true);
  });

  it.each([
    ['run', 'jog'],
    ['tower', 'tall'],
    ['iron', 'metal'],
  ])('%s and %s do not share a lemma', (a, b) => {
    expect(same(a, b)).toBe(false);
  });

  it('keeps every reading of ambiguous forms', () => {
    expect(lemmatizer.lemmas('saw')).toEqual(
      expect.arrayContaining(['saw', 'see']),
    );
    expect(lemmatizer.lemmas('leaves')).toEqual(
      expect.arrayContaining(['leaf', 'leave']),
    );
  });

  it('normalizes case and accents', () => {
    expect(lemmatizer.lemmas('CAFÉS')).toContain('cafe');
  });
});
