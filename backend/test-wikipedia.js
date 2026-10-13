const API_URL = 'https://en.wikipedia.org/w/api.php';
const REST_URL = 'https://en.wikipedia.org/w/rest.php/v1';
const USER_AGENT = 'Transcendix/0.1 (42 project)';
const MAX_CANDIDATES = 10;
const MIN_PARAGRAPHS = 3;
const MAX_PARAGRAPHS = 12;

const stats = {
  candidateRequests: 0,
  candidatesReceived: 0,
  contentRequests: 0,
  rejectedDisambiguation: 0,
  rejectedContent: 0,
  errors429: 0,
  otherErrors: 0,
};

const startedAt = Date.now();

async function request(url, type) {
  if (type === 'candidate') stats.candidateRequests++;
  else stats.contentRequests++;

  const requestStartedAt = Date.now();

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
    });

    const duration = Date.now() - requestStartedAt;
    const retryAfter = response.headers.get('retry-after');

    console.log(
      '  HTTP ' + response.status +
      ' | ' + duration + ' ms' +
      (retryAfter ? ' | Retry-After: ' + retryAfter : ''),
    );

    if (response.status === 429) stats.errors429++;
    else if (!response.ok) stats.otherErrors++;

    return response;
  } catch (error) {
    console.log('  Erreur réseau : ' + error.message);
    stats.otherErrors++;
    return null;
  }
}

async function getCandidates() {
  const url = API_URL +
    '?action=query&format=json&generator=random' +
    '&grnnamespace=0&grnfilterredir=nonredirects' +
    '&grnminsize=50000' +
    '&grnlimit=' + MAX_CANDIDATES +
    '&prop=pageprops&ppprop=disambiguation';

  console.log('Requête groupée des candidats :');

  const response = await request(url, 'candidate');

  if (!response || !response.ok) {
    throw new Error('Échec de récupération des candidats');
  }

  const data = await response.json();
  const pages = data.query?.pages;

  if (!pages) return [];

  return Object.values(pages).map((page) => ({
    id: page.pageid,
    title: page.title,
    isDisambiguation:
      page.pageprops !== undefined &&
      'disambiguation' in page.pageprops,
  }));
}

async function getArticle(title) {
  const encodedTitle = encodeURIComponent(title.replace(/ /g, '_'));

  const response = await request(
    REST_URL + '/page/' + encodedTitle + '/with_html',
    'content',
  );

  if (!response || !response.ok) {
    if (response && response.status === 404) return null;
    throw new Error(
      'Échec de récupération du contenu (HTTP ' +
      (response ? response.status : 'réseau') + ')',
    );
  }

  const data = await response.json();
  const cheerio = require('cheerio');
  const $ = cheerio.load(data.html);
  const paragraphs = [];

  $('p, h2').each((_, element) => {
    if (element.tagName === 'h2') return false;

    const paragraph = $(element);

    if (
      paragraph.closest('table, figure, aside, nav, script, style').length > 0
    ) return;

    paragraph.find('sup.reference').remove();

    const text = paragraph.text().replace(/\s+/g, ' ').trim();
    if (text.length > 0) paragraphs.push(text);
  });

  if (paragraphs.length < MIN_PARAGRAPHS) return null;

  return {
    id: data.id,
    title: data.title,
    paragraphs: paragraphs.slice(0, MAX_PARAGRAPHS),
  };
}

async function main() {
  console.log('=== Diagnostic Wikipédia : candidats groupés ===');
  console.log('Maximum : ' + MAX_CANDIDATES + ' candidats');
  console.log('Pageviews : désactivé');
  console.log('');

  let selectedArticle = null;
  let candidates = [];

  try {
    candidates = await getCandidates();
    stats.candidatesReceived = candidates.length;
    console.log('Candidats reçus : ' + candidates.length);
  } catch (error) {
    console.log('Arrêt : ' + error.message);
  }

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];

    console.log('');
    console.log('Candidat #' + (i + 1) + ' : ' + candidate.title);

    if (candidate.isDisambiguation) {
      stats.rejectedDisambiguation++;
      console.log('  Rejet : page d’homonymie');
      continue;
    }

    try {
      const article = await getArticle(candidate.title);

      if (!article) {
        stats.rejectedContent++;
        console.log('  Rejet : contenu indisponible ou insuffisant');
        continue;
      }

      selectedArticle = article;
      console.log('  Article jouable : oui');
      break;
    } catch (error) {
      console.log('  Arrêt : ' + error.message);
      break;
    }
  }

  console.log('');
  console.log('========== BILAN ==========');
  console.log('Résultat : ' + (selectedArticle ? 'SUCCÈS' : 'ÉCHEC'));

  if (selectedArticle) {
    console.log('Article : ' + selectedArticle.title);
    console.log('Paragraphes : ' + selectedArticle.paragraphs.length);
  }

  console.log('Candidats reçus : ' + stats.candidatesReceived);
  console.log('Appels candidats : ' + stats.candidateRequests);
  console.log('Appels contenu : ' + stats.contentRequests);
  console.log('Pages d’homonymie rejetées : ' + stats.rejectedDisambiguation);
  console.log('Contenus rejetés : ' + stats.rejectedContent);
  console.log('Erreurs HTTP 429 : ' + stats.errors429);
  console.log('Autres erreurs HTTP/réseau : ' + stats.otherErrors);
  console.log(
    'Temps total : ' +
    ((Date.now() - startedAt) / 1000).toFixed(2) + ' s',
  );
}

main().catch((error) => {
  console.error('Erreur inattendue :', error);
  process.exitCode = 1;
});
