import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync,
  rmSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const read = (path) => readFileSync(join(root, path), 'utf8');
const layout = read('templates/layout.html');
const artist = JSON.parse(read('content/about.json'));
const emailLink = 'mailto:' + encodeURIComponent(artist.email).replace('%40', '@');
const renditions = new Map();
const imageIds = new Map();

function readCollection(directory) {
  return readdirSync(join(root, directory), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map(({ name }) => {
      try {
        return { ...JSON.parse(read(join(directory, name))), slug: name.slice(0, -5) };
      } catch (error) {
        throw new Error(`Invalid JSON in ${directory}/${name}`, { cause: error });
      }
    });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function render(template, values) {
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (_, slot) => {
    if (!Object.hasOwn(values, slot)) throw new Error(`Missing template value: ${slot}`);
    return values[slot];
  });
}

function renderPage(title, description, content, current, script) {
  const currentPage = (page) => current === page ? ' aria-current="page"' : '';
  return render(layout, {
    TITLE: escapeHtml(title),
    DESCRIPTION: escapeHtml(description),
    SCRIPT: script ? `    <script defer src="js/${script}"></script>` : '',
    HOME_CURRENT: currentPage('home'),
    WORKS_CURRENT: currentPage('works'),
    ABOUT_CURRENT: currentPage('about'),
    ARTIST_NAME: escapeHtml(artist.name),
    EMAIL_LINK: escapeHtml(emailLink),
    CONTENT: content.trimEnd(),
  });
}

function imagePath(value, title) {
  const path = typeof value === 'string' ? value.replace(/^\//, '') : '';
  if (!path.startsWith('img/uploads/') ||
      path.split('/').some((part) => !part || part === '.' || part === '..') ||
      /[\\\x00-\x1f]/.test(path) || !existsSync(join(root, path))) {
    throw new Error(`Missing or invalid image for "${title}": ${value}`);
  }
  return path;
}

function mediaUrl(path) {
  return escapeHtml(path.split('/').map(encodeURIComponent).join('/'));
}

function resizedImage(path, size, quality) {
  if (path.toLowerCase().endsWith('.svg')) return mediaUrl(path);
  if (!imageIds.has(path)) {
    const id = createHash('sha256').update(readFileSync(join(root, path))).digest('hex').slice(0, 20);
    imageIds.set(path, id);
  }
  const id = imageIds.get(path);
  const url = `media/${id}-${size}.webp`;
  renditions.set(url, { path, url, size, quality });
  return url;
}

function workFile(work) {
  if (work.legacy_url) {
    if (!/^single-project\d*$/.test(work.legacy_url)) {
      throw new Error(`Invalid existing URL for "${work.title}"`);
    }
    return `${work.legacy_url}.html`;
  }
  return `work-${work.slug}.html`;
}

function loadWorks() {
  const routes = new Set();
  return readCollection('content/works').map((work) => {
    if (typeof work.title !== 'string' || !work.title.trim() || !validYear.test(work.year)) {
      throw new Error(`Check the title and year in content/works/${work.slug}.json`);
    }

    const file = workFile(work);
    if (routes.has(file)) throw new Error(`Duplicate work URL: ${file}`);
    routes.add(file);

    const cover = imagePath(work.cover, work.title);
    const photos = (work.photos ?? []).map(({ image }) => imagePath(image, work.title));
    return { ...work, file, cover, photos: photos.length ? photos : [cover] };
  }).sort((a, b) => b.year - a.year ||
    (a.order ?? Infinity) - (b.order ?? Infinity) || a.slug.localeCompare(b.slug, 'ko'));
}

function publicTitle(work) {
  return work.show_title === false ? '제목 미등록' : work.title;
}

function renderCard(work, index) {
  const title = escapeHtml(publicTitle(work));
  return `                <li data-year="${work.year}"${work.object ? ' data-object' : ''}>
                    <a class="work-card" href="${mediaUrl(work.file)}">
                        <div class="card-photo">
                            <img src="${resizedImage(work.cover, 820, 83)}" alt=""${index < 3 ? '' : ' loading="lazy"'} decoding="async">
                        </div>
                        <div class="card-caption">
                            <h2>${title}</h2>
                            <span>${work.year}</span>
                        </div>
                    </a>
                </li>`;
}

function renderPortfolio(years, works) {
  const filters = [
    ['all', '전체'],
    ...Array.from(years).sort((a, b) => b - a).map((year) => [year, year]),
    ['object', '오브제'],
  ].map(([value, label], index) =>
    `                <button type="button" data-filter="${value}" aria-pressed="${index === 0}" aria-controls="works">${label}</button>`);
  return render(read('templates/portfolio.html'), {
    FILTERS: filters.join('\n'),
    WORKS: works.map(renderCard).join('\n'),
  });
}

function originalLink(path) {
  const open = path.toLowerCase().endsWith('.svg') ? 'download' : 'target="_blank" rel="noopener"';
  return `<a class="text-link" data-original href="${mediaUrl(path)}" ${open}>원본 사진 보기</a>`;
}

function renderGallery(photos, title) {
  const multiple = photos.length > 1;
  const slides = photos.map((path, index) =>
    `                        <li data-original="${mediaUrl(path)}">
                            <img src="${resizedImage(path, 2000, 88)}" alt="${title}${multiple ? ' · 사진 ' + (index + 1) : ''}"${index ? ' loading="lazy"' : ' fetchpriority="high"'} decoding="async">
                        </li>`);
  const controls = multiple ? `                    <div class="work-gallery-controls" hidden>
                        <button type="button" data-prev aria-label="이전 사진">←</button>
                        <span data-position aria-live="polite">1 / ${photos.length}</span>
                        <button type="button" data-next aria-label="다음 사진">→</button>
                    </div>` : '';
  return `                <section class="work-gallery" aria-label="작품 사진">
                    <ul class="work-gallery-slides"${multiple ? ' tabindex="0" aria-label="가로로 스크롤해 사진 보기"' : ''}>
${slides.join('\n')}
                    </ul>
                    <div class="work-gallery-footer">
${controls}
                        ${originalLink(photos[0])}
                    </div>
                </section>`;
}

function renderWork(template, work) {
  const title = work.show_title === false ? publicTitle(work) : (work.detail_title || work.title);
  const metadata = [['재료', work.materials], ['크기', work.size]]
    .filter(([, value]) => value).map(([label, value]) =>
      `                        <div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`);
  const details = [];
  if (work.heading && work.heading !== work.title) {
    details.push(`                    <p class="work-heading">${escapeHtml(work.heading)}</p>`);
  }
  if (metadata.length) {
    details.push('                    <dl class="work-meta">', ...metadata, '                    </dl>');
  }
  if (work.description) {
    details.push(`                    <p class="work-description">${escapeHtml(work.description)}</p>`);
  }
  return render(template, {
    YEAR: work.year,
    YEAR_HASH: '#' + work.year,
    TITLE: escapeHtml(title),
    DETAILS: details.join('\n'),
    GALLERY: renderGallery(work.photos, escapeHtml(publicTitle(work))),
  });
}

function exhibitionVideoLink(address) {
  if (!address) return '';
  const video = new URL(address);
  const youtubeHosts = ['www.youtube.com', 'youtube.com', 'm.youtube.com', 'youtu.be'];
  if (video.protocol !== 'https:' || !youtubeHosts.includes(video.hostname) ||
      video.username || video.password || video.port || video.pathname === '/') {
    throw new Error('Enter a valid YouTube address for the exhibition video in content/about.json.');
  }

  return `                            <a class="youtube-link" href="${escapeHtml(video.href)}" aria-label="개인전 영상 보기 (YouTube)">
                                <img src="img/youtube.png" width="150" height="106" alt="">
                            </a>`;
}

function renderAboutSection(title, items = [], link = '') {
  if (!items.length && !link) return '';
  const rows = items.map(({ year, description }) =>
    `                            <li><time>${escapeHtml(year)}</time><span>${escapeHtml(description)}</span></li>`);
  const heading = link ? `                        <div class="about-section-heading">
                            <h3>${title}</h3>
${link}
                        </div>` : `                        <h3>${title}</h3>`;
  return `                    <section>
${heading}
${rows.length ? '                        <ul>\n' + rows.join('\n') + '\n                        </ul>\n' : ''}                    </section>`;
}

function renderAbout() {
  return render(read('templates/about.html'), {
    PORTRAIT: resizedImage(imagePath(artist.portrait, '작가 사진'), 1200, 88),
    PORTRAIT_ALT: escapeHtml(artist.portrait_alt),
    ARTIST_NAME: escapeHtml(artist.name),
    ARTIST_NAME_EN: escapeHtml(artist.name_en),
    EDUCATION: renderAboutSection('학력', artist.education ?? []),
    EXHIBITIONS: renderAboutSection('개인전', artist.exhibitions ?? [], exhibitionVideoLink(artist.exhibition_video)),
    EMAIL: escapeHtml(artist.email),
    EMAIL_LINK: escapeHtml(emailLink),
  });
}

function externalGithubBackend(repo, branch, authUrl, options = []) {
  const url = new URL(authUrl);
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('Check the GitHub repository and HTTPS login URL for Decap CMS.');
  }
  return [
    'backend:',
    '  name: github',
    `  repo: ${JSON.stringify(repo)}`,
    `  branch: ${JSON.stringify(branch)}`,
    `  base_url: ${JSON.stringify(url.href.replace(/\/$/, ''))}`,
    ...options,
  ].join('\n');
}

function adminBackend() {
  const {
    NETLIFY, CONTEXT, REPOSITORY_URL, BRANCH, CF_PAGES, CF_PAGES_BRANCH,
    B127_GITHUB_PAGES, GITHUB_REPOSITORY, GITHUB_REF_NAME, B127_SITE_URL,
    B127_CMS_AUTH_URL, B127_CMS_REPO, B127_CMS_BRANCH = 'main',
  } = process.env;
  if (B127_GITHUB_PAGES === 'true') {
    if (!B127_CMS_AUTH_URL) return null;
    return externalGithubBackend(GITHUB_REPOSITORY, GITHUB_REF_NAME || 'main', B127_CMS_AUTH_URL, [
      '  auth_scope: public_repo',
      ...(B127_SITE_URL ? [`site_url: ${JSON.stringify(B127_SITE_URL)}`] : []),
    ]);
  }
  if (CF_PAGES === '1') {
    if (CF_PAGES_BRANCH !== B127_CMS_BRANCH || !B127_CMS_REPO || !B127_CMS_AUTH_URL) return null;
    return externalGithubBackend(B127_CMS_REPO, B127_CMS_BRANCH, B127_CMS_AUTH_URL);
  }
  if (NETLIFY !== 'true') {
    return 'backend:\n  name: github\n  repo: local/b127\n  branch: main\nlocal_backend: true';
  }
  if (CONTEXT !== 'production') return null;

  const repo = REPOSITORY_URL?.match(
    /^(?:https:\/\/github\.com\/|git@github\.com:)([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/,
  )?.[1];
  if (!repo || !BRANCH) throw new Error('Link the Netlify project to the B-127 GitHub repository.');
  return `backend:\n  name: github\n  repo: ${JSON.stringify(repo)}\n  branch: ${JSON.stringify(BRANCH)}`;
}

const validYear = /^[1-9]\d{3}$/;
const registeredYears = readCollection('content/years').map(({ title }) => String(title));
if (registeredYears.some((year) => !validYear.test(year))) {
  throw new Error('Each registered year must have four digits.');
}
const works = loadWorks();
const years = new Set([...registeredYears, ...works.map((work) => String(work.year))]);
const workTemplate = read('templates/work.html');
const home = JSON.parse(read('content/home.json'));
const pages = new Map([
  ['index.html', renderPage(`B-127 · ${artist.name}`, `${artist.name} 도예 작품 포트폴리오`,
    render(read('templates/home.html'), {
      ARTIST_NAME: escapeHtml(artist.name),
      ARTIST_NAME_EN: escapeHtml(artist.name_en),
      HERO_IMAGE: resizedImage(imagePath(home.image, '메인 사진'), 1440, 88),
      HERO_ALT: escapeHtml(home.alt),
      WORKS: works.slice(0, 3).map(renderCard).join('\n'),
    }), 'home')],
  ['about.html', renderPage('작가 소개 · B-127', `${artist.name} 작가 소개와 전시 이력`, renderAbout(), 'about')],
  ['portfolio.html', renderPage('작품 · B-127', `${artist.name}의 도예 작품을 연도별로 둘러보세요.`,
    renderPortfolio(years, works), 'works', 'portfolio.js')],
  ...works.map((work) => [work.file, renderPage(`${publicTitle(work)} · B-127`,
    work.description || `${work.year}년 ${artist.name} 도예 작품`, renderWork(workTemplate, work),
    null, work.photos.length > 1 ? 'work-gallery.js' : '')]),
]);
const backend = adminBackend();
const output = mkdtempSync(join(root, '.build-'));
try {
  for (const asset of ['css', 'img', 'js']) {
    cpSync(join(root, asset), join(output, asset), { recursive: true });
  }
  const mediaManifest = join(output, '.media-input.json');
  writeFileSync(mediaManifest, JSON.stringify([...renditions.values()]));
  execFileSync('python3', [join(root, 'prepare_media.py'), output, mediaManifest], {
    cwd: root, stdio: 'inherit',
  });
  rmSync(mediaManifest);
  for (const [path, html] of pages) writeFileSync(join(output, path), html);
  if (backend || process.env.B127_GITHUB_PAGES === 'true') {
    mkdirSync(join(output, 'admin'));
    const adminPage = backend ? 'index.html' : 'connect.html';
    cpSync(join(root, 'admin', adminPage), join(output, 'admin/index.html'));
    if (backend) {
      writeFileSync(join(output, 'admin/config.yml'), backend + '\n\n' + read('admin/collections.yml'));
    }
  }
  rmSync(join(root, 'dist'), { recursive: true, force: true });
  renameSync(output, join(root, 'dist'));
} finally {
  rmSync(output, { recursive: true, force: true });
}
console.log(`Built ${works.length} works and ${years.size} years in dist/.`);
